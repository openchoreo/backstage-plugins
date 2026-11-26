import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  Drawer,
  IconButton,
  InputAdornment,
  Snackbar,
  TextField,
  Tooltip,
  Typography,
} from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import SendIcon from '@material-ui/icons/Send';
import StopIcon from '@material-ui/icons/Stop';
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';
import AndroidOutlinedIcon from '@material-ui/icons/AndroidOutlined';
import FileCopyOutlinedIcon from '@material-ui/icons/FileCopyOutlined';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import { useApi } from '@backstage/core-plugin-api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remend from 'remend';
import {
  portalAssistantApiRef,
  type ChatMessage,
  type ChatScope,
  type ConfirmationRequired,
  type ConfirmResult,
  type DryRunResult,
  type Experience,
  type StreamEvent,
} from '../../api/PortalAssistantApi';
import type { PinnedContext } from '../AssistantContext/AssistantDrawerContext';
import { AgentUi, hasReplyCard, hasSaveCard } from '../AgentUi/AgentUi';
import type { AgentUiComposer, OpenedCheck } from '../AgentUi/context';
import { ComponentPicker } from '../ComponentPicker/ComponentPicker';
import {
  ConfirmCard,
  ConfirmCardNextStep,
  ConfirmCardSkipTest,
  SHOW_FACTS,
  ConfirmCardTestPicker,
  type SavedCheck,
} from '../ConfirmCard/ConfirmCard';
import { LiveProgressCard } from '../LiveProgressCard/LiveProgressCard';
import { useStyles } from './styles';
import { splitForCollapse, splitForStreaming } from './splitForCollapse';
import { editCheckIntro } from './editCheckIntro';
import {
  EXPERIENCE_LEVELS,
  newCheckIntro,
  OWN_CHECK_HINT,
} from './newCheckIntro';
import { SavedNextStep } from './SavedNextStep';

/**
 * Strip ``<comp:NAME>`` / ``<proj:NAME>`` / ``<env:NAME>`` /
 * ``<ns:NAME>`` entity tags from assistant text. The prompt used to
 * tell the model to emit these as a hook for the UI to render styled
 * chips; the chips never shipped, so the tags would just leak through
 * react-markdown as literal text (``<comp:lab-frontend>``). The
 * prompt has since been updated to use plain backticked names, but a
 * cached / mid-stream model output may still emit the old form —
 * normalise here so it renders as the bare name in backticks.
 */
const ENTITY_TAG_RE = /<(?:comp|proj|env|ns):([^>]+)>/g;
function stripEntityTags(text: string): string {
  return text.replace(ENTITY_TAG_RE, '`$1`');
}

/** The scope fields of a chat about a saved check (see ChatScope.checkId). */
function checkScope(check: OpenedCheck): Partial<ChatScope> {
  return {
    checkId: check.checkId,
    checkName: check.name,
    ...(check.description ? { checkDescription: check.description } : {}),
    currentRule: check.rule,
    ...(check.factIds?.length ? { selectedFactIds: check.factIds } : {}),
  };
}

// A check authoring reply's hand-off from the live progress card: the card
// shows every step done for READY_MS, then folds away over LEAVE_MS while
// the reply fades in where it was (styles: handoff, handedOff).
const READY_MS = 300;
const LEAVE_MS = 280;
const pause = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Pulls the structured check object out of a check_authoring reply's
 * fenced ```json block, so individual fields can get their own copy
 * button instead of one big blob. Returns null for any other reply
 * shape (non-JSON, malformed, or no json fence at all) so callers
 * fall back to the normal markdown rendering.
 */
type ParsedCheckSections = {
  name?: string;
  description?: string;
  factRetriever?: string;
  isSuggestedFactRetriever?: boolean;
  category?: string;
  maturityTier?: string;
  ruleJson?: string;
  /**
   * Text before "Name:" (or before the json fence when there is no
   * "Name:", as in edit-check replies), e.g. the "Tested on …" summary.
   */
  preamble?: string;
  /** Text after the json fence that isn't a parsed suggestion. */
  trailing?: string;
  /** Edit replies' "Suggested related changes" bullets, each copyable. */
  suggestions?: SuggestedChange[];
};

type SuggestedChange = { field: string; from?: string; to: string };

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  description: 'Description',
};

const SUGGESTIONS_HEADING_RE = /^\s*\**Suggested related changes:?\**:?\s*$/im;
// One suggestion per line: "- Description: `old` → `new`". Tolerates the
// variations small models produce — "**Description:**", "1." or no bullet,
// quotes instead of backticks, "->" for the arrow, or only the new text.
const SUGGESTION_RE =
  /^[ \t]*(?:[-*]|\d+[.)])?[ \t]*\**(Name|Description)\**(?:[ \t]*\(new\))?\**[ \t]*:[ \t]*\**[ \t]*(.+?)[ \t]*$/gim;
const SUGGESTION_ARROW_RE = /\s+(?:→|->)\s+/;

/**
 * Strips the backticks, quotes and bold markers models wrap values in,
 * plus stray punctuation after the closing one (e.g. "…required`.").
 */
function unwrapValue(value: string): string {
  return value
    .trim()
    .replace(/[`"*]+[.,;:!]*$/, '')
    .replace(/^[`"*]+/, '')
    .trim();
}

/**
 * Splits an edit reply's trailing text into copyable suggestions and
 * whatever is left (e.g. "- None — …"), which still renders as markdown.
 */
function extractSuggestions(trailing: string | undefined): {
  suggestions?: SuggestedChange[];
  rest?: string;
} {
  if (!trailing) return {};
  const suggestions: SuggestedChange[] = [];
  const rest = trailing.replace(
    SUGGESTION_RE,
    (match, field: string, body: string) => {
      const parts = body.split(SUGGESTION_ARROW_RE);
      const to = unwrapValue(parts[parts.length - 1]);
      if (!to) return match;
      suggestions.push({
        field: FIELD_LABELS[field.toLowerCase()] ?? field,
        from: parts.length > 1 ? unwrapValue(parts[0]) || undefined : undefined,
        to,
      });
      return '';
    },
  );
  if (suggestions.length === 0) return { rest: trailing };
  const leftover = rest.replace(SUGGESTIONS_HEADING_RE, '').trim();
  return { suggestions, rest: leftover || undefined };
}

/** True for a json-rules-engine root (`all`/`any`/`not`/`condition`) missing its `conditions` wrapper. */
function isBareConditions(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return (
    keys.length === 1 && ['all', 'any', 'not', 'condition'].includes(keys[0])
  );
}

// The model sometimes bolds the field labels ("**Name:** …" or
// "- **Name**: …"); read them as plain labels so the confirm card still
// replaces them.
const BOLD_LABEL_RE =
  /^[ \t]*(?:[-*][ \t]+)?\*\*(Name|Description|Suggested Fact Retriever|Fact Retriever|Suggested Category|Suggested Maturity Tier):?\*\*:?/gm;

function extractCheckSections(reply: string): ParsedCheckSections | null {
  const text = reply.replace(BOLD_LABEL_RE, '$1:');
  // Accept a plain ``` fence too — small models sometimes drop the tag.
  const ruleMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  // Form fields come before the rule; anything after it (an edit reply's
  // "Description: old → new" suggestions) must not be read as one.
  const head = ruleMatch ? text.slice(0, ruleMatch.index) : text;
  const nameMatch = /^Name:\s*(.+)$/m.exec(head);
  const descMatch = /^Description:\s*(.+)$/m.exec(head);
  // "Suggested Fact Retriever:" (no retriever selected yet) and
  // "Fact Retriever:" (one already selected) are mutually exclusive —
  // see perch_prompt.j2's CHECK AUTHORING "Response format" section.
  const suggestedRetrieverMatch = /^Suggested Fact Retriever:\s*(.+)$/m.exec(
    head,
  );
  const retrieverMatch = /^Fact Retriever:\s*(.+)$/m.exec(head);
  const categoryMatch = /^Suggested Category:\s*(.+)$/m.exec(head);
  const tierMatch = /^Suggested Maturity Tier:\s*(.+)$/m.exec(head);
  if (
    !nameMatch &&
    !descMatch &&
    !suggestedRetrieverMatch &&
    !retrieverMatch &&
    !categoryMatch &&
    !tierMatch &&
    !ruleMatch
  ) {
    return null;
  }

  // Edit-check replies have no "Name:" line, so their preamble ends at the fence.
  const firstMatch = nameMatch ?? ruleMatch;

  let ruleJson = ruleMatch?.[1]?.trim();
  if (ruleJson) {
    try {
      // Re-serialize with consistent 2-space indentation, regardless of
      // how compactly the model formatted individual leaf conditions.
      let parsed = JSON.parse(ruleJson);
      // The Rule field expects `{ "conditions": ... }`; if the model
      // dropped that wrapper, add it back so a copied rule always pastes.
      if (isBareConditions(parsed)) {
        parsed = { conditions: parsed };
      }
      ruleJson = JSON.stringify(parsed, null, 2);
    } catch {
      // Leave as-is if it doesn't parse — still shown, just unformatted.
    }
  }

  const { suggestions, rest } = extractSuggestions(
    ruleMatch
      ? text.slice(ruleMatch.index + ruleMatch[0].length).trim() || undefined
      : undefined,
  );

  return {
    name: nameMatch?.[1]?.trim(),
    description: descMatch?.[1]?.trim(),
    factRetriever: (suggestedRetrieverMatch ?? retrieverMatch)?.[1]?.trim(),
    isSuggestedFactRetriever: !!suggestedRetrieverMatch,
    category: categoryMatch?.[1]?.trim(),
    maturityTier: tierMatch?.[1]?.trim(),
    ruleJson,
    preamble: firstMatch
      ? text.slice(0, firstMatch.index).trim() || undefined
      : undefined,
    trailing: rest,
    suggestions,
  };
}

// Module-level sentinel — a per-render symbol would never match the previous
// render's symbol, breaking the conversationKey continuity check.
const NO_KEY_YET = Symbol('no-key-yet');

/**
 * Derive a default ChatScope from the current Backstage URL. This is a
 * deliberately light-touch heuristic — it parses catalog routes like
 *   /catalog/<namespace>/component/<name>
 * and feeds them to the agent as default context. The agent is soft-scoped,
 * so users can still ask cross-tenant questions; this just saves them from
 * repeating the obvious.
 */
function deriveScopeFromPath(pathname: string): ChatScope {
  // /catalog/:namespace/:kind/:name[/...]
  const match = /^\/catalog\/([^/]+)\/([^/]+)\/([^/]+)/.exec(pathname);
  if (!match) return {};
  const [, namespace, kind, name] = match;
  const lower = kind.toLowerCase();
  const scope: ChatScope = { namespace };
  if (lower === 'component') scope.component = name;
  else if (lower === 'system') scope.project = name;
  return scope;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /**
   * Optional message to send as the first user turn whenever ``openSeq``
   * advances. Used by external triggers (failed-build snackbar, etc.) so
   * the agent starts analyzing immediately instead of waiting for typing.
   */
  initialMessage?: string;
  /**
   * Optional pinned resource context. Rendered as a chip above the
   * composer and forwarded to the backend via {@link ChatScope}.
   */
  pin?: PinnedContext;
  /**
   * Optional ChatScope overrides merged into the computed scope. Used by
   * launchers that don't fit the workflow_run pin model but still need
   * to inject scope fields (caseType, namespace, project, component).
   * Applied last so it wins over both URL- and pin-derived values.
   */
  scopeOverrides?: Partial<ChatScope>;
  /**
   * Stable per-context identifier. Re-opening with the same key preserves
   * the timeline (no wipe, no re-seed). A different key wipes + seeds.
   * Lets launchers say "this is the same conversation as before".
   */
  conversationKey?: string;
  /**
   * When true, force the drawer to wipe the existing timeline and re-seed
   * even if ``conversationKey`` matches the last-seeded key. Used by the
   * "Start new" choice on launchers.
   */
  resetConversation?: boolean;
  /**
   * Monotonic counter from {@link useAssistantDrawer}. We watch this to
   * detect a new "open with seed" event even when ``open`` was already
   * true (e.g. clicking another Debug button while the drawer is up).
   */
  openSeq?: number;
  /**
   * Launcher-supplied empty-state suggestion chips. When present, these
   * replace the per-caseType defaults below — used by launchers that
   * know the user's concrete object (a specific failing trace, a
   * particular workflow run) and want chips to reference it by name.
   */
  suggestions?: string[];
  /** Called after a confirm card in this chat saves a check. */
  onChecksChanged?: () => void;
}

export const AssistantChatDrawer = ({
  open,
  onClose,
  initialMessage,
  pin,
  scopeOverrides,
  conversationKey,
  resetConversation,
  suggestions,
  onChecksChanged,
  openSeq,
}: Props) => {
  const classes = useStyles();
  const api = useApi(portalAssistantApiRef);
  const location = useLocation();

  // Recompute scope on every navigation; old conversations stay readable
  // but new turns use the latest scope. The pinned context (if any)
  // overrides URL-derived component/namespace so an explicit pin always wins.
  // scopeOverrides is applied last and wins over everything.
  // How much a check authoring user knows about checks: picked in the first
  // message of each chat (not remembered for the next one).
  const [experience, setExperience] = useState<Experience>();
  const baseScope = useMemo(() => {
    const fromPath = deriveScopeFromPath(location.pathname);
    const fromPin: ChatScope = pin
      ? {
          ...fromPath,
          namespace: pin.namespace,
          component: pin.component,
          project: pin.project ?? fromPath.project,
          runName: pin.runName,
          runStatus: pin.runStatus,
          workflowName: pin.workflowName,
          workflowKind: pin.workflowKind,
          caseType: pin.caseType,
          // Forwarded so the agent can drop the URL and in-repo build
          // path into the ``fix_prompt`` it generates on build_failure
          // turns (``Repo:`` + ``Path:`` lines).
          repoUrl: pin.repoUrl,
          componentPath: pin.componentPath,
        }
      : fromPath;
    const merged = scopeOverrides ? { ...fromPin, ...scopeOverrides } : fromPin;
    return merged.caseType === 'check_authoring' && experience
      ? { ...merged, experience }
      : merged;
  }, [location.pathname, pin, scopeOverrides, experience]);

  // Once a save card saved a check, the rest of the chat is about that
  // check, as an edit chat for it: a test only tests it, and a later change
  // updates it instead of creating another check. Cleared with the chat.
  const [savedCheck, setSavedCheck] = useState<SavedCheck>();
  const scope = useMemo<ChatScope>(
    () =>
      savedCheck ? { ...baseScope, ...checkScope(savedCheck) } : baseScope,
    [baseScope, savedCheck],
  );

  // "Edit with AI" opens with an intro to the check instead: its current
  // rule and two questions, drawn by the drawer (editCheckIntro). It is
  // worked out from the scope, never sent to the agent, and survives Clear.
  const editIntro = useMemo(
    () =>
      baseScope.caseType === 'check_authoring' && baseScope.checkId
        ? editCheckIntro(baseScope)
        : undefined,
    [baseScope],
  );
  // A new check's chat opens with its own intro card (newCheckIntro): the
  // opening, the levels and the user's own check, the same every time.
  const newIntro = useMemo(() => newCheckIntro(), []);
  // A new check's chat opens with the level picker, in fixed words, at once.
  // Picking a level sends its message, and the agent's reply is the welcome
  // for that level — an ordinary turn of the chat.

  // The agent is read-only — every timeline item is a plain user / assistant
  // message. The unified-item shape is kept (rather than ChatMessage[])
  // so future non-message variants can slot in without restructuring.
  //
  // ``fixPrompt`` is set ONLY on assistant items when the agent's
  // terminal DoneEvent carried a ``fix_prompt`` field (build_failure
  // turns with a code-level cause). The drawer uses its presence to
  // gate the per-message "Copy as prompt" affordance — the frontend
  // never synthesises this; it copies the backend payload verbatim.
  //
  // ``confirmation`` is the check change the agent sent with this turn
  // (check_authoring only), rendered as a confirm card under the reply.
  //
  // ``ui`` is the A2UI messages the agent sent with this turn (today the
  // answer buttons of a check edit question), rendered under the reply.
  //
  // ``handedOff`` marks a reply that took the live progress card's place:
  // it fades in where the card was.
  //
  // A ``next`` item is the drawer's own follow-up after a save card saved
  // a check (SavedNextStep): it is shown, never sent to the agent. So is an
  // ``intro`` item: the "Edit this check" intro of a saved check the user
  // chose to edit instead of creating the same check again.
  type ChatItem =
    | {
        kind: 'message';
        role: 'user' | 'assistant';
        content: string;
        fixPrompt?: string;
        confirmation?: ConfirmationRequired;
        ui?: unknown[];
        handedOff?: boolean;
      }
    | { kind: 'next'; saved: SavedCheck }
    | { kind: 'intro'; ui: unknown[] };

  /** Whether an item carries a save card (as A2UI or the plain card). */
  const hasSave = (item: ChatItem) =>
    item.kind === 'message' && (!!item.confirmation || hasSaveCard(item.ui));

  const [timeline, setTimeline] = useState<ChatItem[]>([]);
  // The drawer stays mounted while closed: opened again with no chat yet is
  // a new chat, so it asks for the level again. A chat under way keeps it.
  const wasOpen = useRef(open);
  const timelineEmpty = timeline.length === 0;
  useEffect(() => {
    if (open && !wasOpen.current && timelineEmpty) {
      setExperience(undefined);
    }
    wasOpen.current = open;
  }, [open, timelineEmpty]);
  const [input, setInput] = useState('');
  // A card's hint for what to type next ("Tell me something else"); cleared once a
  // message is sent.
  const [composerHint, setComposerHint] = useState<string | null>(null);
  const [streaming, setStreaming] = useState<string>('');
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  // What the turn in flight has done so far, for the live progress card of
  // a check authoring turn: each step the agent reported (newest last) and
  // a dry-run's result. ``ready`` once the reply has arrived, ``leaving``
  // while the reply takes the card's place. Null when no turn is waiting.
  const [progress, setProgress] = useState<{
    steps: string[];
    result?: DryRunResult;
    startedAt: number;
    ready?: boolean;
    leaving?: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  // Toast for the "Copy as prompt" action on build_failure assistant
  // turns. Null when no toast is showing; non-null string carries the
  // message text (success copy + failure mode share the same component).
  const [copyToast, setCopyToast] = useState<string | null>(null);
  // Which assistant turns currently have their fix_prompt expanded
  // inline (chevron toggled on). Keyed by timeline index — stable
  // across turns because new turns append. A Set rather than a single
  // index so power users can keep multiple prompts open side-by-side.
  const [expandedPrompts, setExpandedPrompts] = useState<Set<number>>(
    () => new Set(),
  );
  const toggleExpandPrompt = useCallback((index: number) => {
    setExpandedPrompts(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);
  // Forwarded to TextField.inputRef so the seed effect can focus the
  // composer after drafting a launcher's prefilled message.
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  // The message box as a check authoring chat's cards use it: they type
  // into it and point the user to it instead of having their own box and
  // Send (see AgentUiComposerContext). Other chats' cards keep theirs.
  const composer = useMemo<AgentUiComposer | undefined>(
    () =>
      scope.caseType === 'check_authoring'
        ? {
            write: text => {
              setInput(text);
              composerRef.current?.focus();
            },
            focus: hint => {
              setComposerHint(hint || null);
              composerRef.current?.focus();
            },
          }
        : undefined,
    [scope.caseType],
  );

  // Helpers — derive text-only ChatMessage history (what the backend wants)
  // from the unified timeline.
  const messageHistory: ChatMessage[] = useMemo(
    () =>
      timeline.flatMap(item =>
        item.kind === 'message'
          ? [{ role: item.role, content: item.content }]
          : [],
      ),
    [timeline],
  );

  const abortRef = useRef<AbortController | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  // The latest reply, while it is one handed off from the live progress card.
  const handedOffRef = useRef<HTMLDivElement | null>(null);
  // Counts turns and resets, so a hand-off still pausing when the chat is
  // cleared or a new one starts leaves the new timeline alone.
  const turnRef = useRef(0);

  // Auto-scroll to the bottom on new content — except to a handed-off reply
  // taller than the drawer: show its head, where the card was, not its end.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const reply = handedOffRef.current;
    if (reply && reply.offsetHeight > el.clientHeight) {
      el.scrollTo({
        top:
          el.scrollTop +
          reply.getBoundingClientRect().top -
          el.getBoundingClientRect().top,
        behavior: 'smooth',
      });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, [timeline, streaming, toolStatus, progress, error]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleClear = useCallback(() => {
    abortRef.current?.abort();
    turnRef.current++;
    setTimeline([]);
    setSavedCheck(undefined);
    setStreaming('');
    setToolStatus(null);
    setProgress(null);
    setComposerHint(null);
    setExperience(undefined);
    setError(null);
    // expandedPrompts is keyed by timeline index, so it must be wiped
    // whenever the timeline is — otherwise indices from the previous
    // chat would reopen against unrelated assistant turns once new
    // items land at the same positions.
    setExpandedPrompts(new Set());
  }, []);

  // Copy whatever the backend put on ``DoneEvent.fix_prompt`` into the
  // clipboard. The drawer does NOT synthesise the prompt — the agent
  // has the real tool-call context (logs, error excerpts, repo URL
  // from scope) and produces a far better-targeted prompt than the
  // frontend ever could. We just expose it to the user.
  const handleCopyPrompt = useCallback(
    async (
      prompt: string,
      successMessage = 'Copied — paste into your AI coding assistant',
    ) => {
      try {
        // Prefer the async Clipboard API (only available on secure
        // contexts — https + localhost). Fall back to the legacy
        // execCommand path so http-served Backstage instances still
        // work — the textarea is briefly mounted off-screen so the
        // user never sees it.
        let succeeded = false;
        if (
          typeof navigator !== 'undefined' &&
          navigator.clipboard?.writeText
        ) {
          await navigator.clipboard.writeText(prompt);
          succeeded = true;
        } else {
          const ta = document.createElement('textarea');
          ta.value = prompt;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          try {
            ta.select();
            // execCommand returns boolean — false means the browser
            // refused to copy (focus rules, sandbox flags, etc.). Treat
            // that as a failure so the toast tells the truth.
            succeeded = document.execCommand('copy');
          } finally {
            // ``finally`` guarantees the off-screen textarea is removed
            // even if ``select()`` / ``execCommand`` throw — otherwise
            // a copy attempt that hits a sandbox restriction would leak
            // a hidden element into the DOM on every click.
            document.body.removeChild(ta);
          }
        }
        if (succeeded) {
          setCopyToast(successMessage);
        } else {
          setCopyToast('Copy failed — please copy manually');
        }
      } catch (e) {
        setCopyToast(
          `Copy failed: ${e instanceof Error ? e.message : 'unknown error'}`,
        );
      }
    },
    [],
  );

  const sendMessage = useCallback(
    async (
      rawText: string,
      options?: {
        resetHistory?: boolean;
        // Added to this turn's scope only (e.g. the level just picked).
        scope?: Partial<ChatScope>;
        // About a new check, not the one saved in this chat.
        newCheck?: boolean;
      },
    ) => {
      const trimmed = rawText.trim();
      if (!trimmed || isSending) return;
      const turn = ++turnRef.current;
      const chatScope = options?.newCheck ? baseScope : scope;
      const turnScope = options?.scope
        ? { ...chatScope, ...options.scope }
        : chatScope;

      const userItem: ChatItem = {
        kind: 'message',
        role: 'user',
        content: trimmed,
      };
      // resetHistory: true means start a fresh conversation — both the
      // visible timeline and the request body sent to the agent drop the
      // prior turns. Used when an external launcher seeds the drawer with
      // a new task (build_failure → runtime_debug, etc.) so context from
      // the previous task doesn't leak into the new one.
      const baseHistory: ChatMessage[] = options?.resetHistory
        ? []
        : messageHistory;
      const nextHistory: ChatMessage[] = [
        ...baseHistory,
        { role: 'user', content: trimmed },
      ];
      // resetHistory has no in-component caller today; the option is kept
      // for external callers that may be wired up later. Skip the truthy
      // branch in coverage so the dead path doesn't show as missing.
      /* istanbul ignore if */
      if (options?.resetHistory) {
        abortRef.current?.abort();
        setTimeline([userItem]);
        // Index-keyed UI state must follow the timeline reset — see the
        // comment on the analogous call in handleClear.
        setExpandedPrompts(new Set());
      } else {
        setTimeline(prev => [...prev, userItem]);
      }
      setIsSending(true);
      setComposerHint(null);
      setStreaming('');
      setToolStatus(null);
      setProgress({ steps: [], startedAt: Date.now() });
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;
      // Arrive before ``done``; attached to the reply they belong to.
      let confirmation: ConfirmationRequired | undefined;
      let ui: unknown[] | undefined;
      // A check authoring reply taking the live progress card's place.
      let handoff: Promise<void> | undefined;

      try {
        await api.streamChat(
          {
            messages: nextHistory,
            scope: Object.keys(turnScope).length > 0 ? turnScope : undefined,
          },
          (event: StreamEvent) => {
            switch (event.type) {
              case 'message_chunk':
                setStreaming(prev => prev + event.content);
                setToolStatus(null);
                break;
              case 'tool_call': {
                const step = event.activeForm ?? `Running ${event.tool}…`;
                setToolStatus(step);
                setProgress(prev =>
                  prev && prev.steps[prev.steps.length - 1] !== step
                    ? { ...prev, steps: [...prev.steps, step] }
                    : prev,
                );
                break;
              }
              case 'dry_run_result':
                setProgress(prev => prev && { ...prev, result: event });
                break;
              case 'confirmation_required':
                confirmation = event;
                break;
              case 'a2ui':
                ui = event.messages;
                break;
              case 'done': {
                const reply: ChatItem | undefined =
                  typeof event.message === 'string' && event.message !== ''
                    ? {
                        kind: 'message',
                        role: 'assistant',
                        content: event.message,
                        // Snake_case on the wire (matches the backend's
                        // DoneEvent field). Only set on build_failure
                        // turns where the agent surfaced a code-level
                        // cause; absent for everything else.
                        fixPrompt: event.fix_prompt || undefined,
                        confirmation,
                        ui,
                      }
                    : undefined;
                setStreaming('');
                setToolStatus(null);
                // A check authoring reply takes the live progress card's
                // place smoothly, unless the browser asks for reduced
                // motion (or can't tell).
                const smooth =
                  scope.caseType === 'check_authoring' &&
                  window.matchMedia?.('(prefers-reduced-motion: no-preference)')
                    .matches;
                if (!smooth) {
                  if (reply) setTimeline(prev => [...prev, reply]);
                  setProgress(null);
                  break;
                }
                handoff = (async () => {
                  setProgress(prev => prev && { ...prev, ready: true });
                  await pause(READY_MS);
                  if (turnRef.current !== turn) return;
                  if (reply) {
                    setTimeline(prev => [
                      ...prev,
                      { ...reply, handedOff: true },
                    ]);
                  }
                  setProgress(prev => prev && { ...prev, leaving: true });
                  await pause(LEAVE_MS);
                  if (turnRef.current === turn) setProgress(null);
                })();
                break;
              }
              case 'error':
                setError(event.message);
                setStreaming('');
                setToolStatus(null);
                setProgress(null);
                break;
              default:
                break;
            }
          },
          controller.signal,
        );
        // The turn (and the disabled composer) lasts until the reply has
        // taken the card's place.
        await handoff;
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err.message);
        }
      } finally {
        setIsSending(false);
        abortRef.current = null;
      }
    },
    [api, isSending, messageHistory, scope, baseScope],
  );

  const handleSend = useCallback(async () => {
    const value = input;
    setInput('');
    await sendMessage(value);
  }, [input, sendMessage]);

  // Click handler for the empty-state suggestion chips. Sends the
  // chosen prompt immediately — the chips themselves are pre-vetted
  // wording, so a confirm-then-send dance would be friction without
  // benefit. Clears any composer draft so the user doesn't see stale
  // text after the chip-fired turn renders.
  const handleSuggestion = useCallback(
    (prompt: string) => {
      setInput('');
      void sendMessage(prompt);
    },
    [sendMessage],
  );

  // A save card saved a check: refresh the page's check list and carry on
  // with the saved check.
  const handleSaved = useCallback(
    (_result: ConfirmResult, saved: SavedCheck) => {
      onChecksChanged?.();
      setSavedCheck(saved);
      setTimeline(prev => [...prev, { kind: 'next', saved }]);
    },
    [onChecksChanged],
  );

  // The user chose to edit a saved check a card found like their draft: the
  // rest of the chat is about that check, as after a save. A change to make
  // is sent at once, in that check's scope; without one, the check's "Edit
  // this check" intro shows, as from "Edit with AI".
  const handleOpenCheck = useCallback(
    (check: OpenedCheck, message?: string) => {
      if (isSending) return;
      setSavedCheck({
        ...check,
        kind: 'update',
        wasPublished: check.status === 'published',
      });
      if (message) {
        void sendMessage(message, { scope: checkScope(check) });
      } else {
        const ui = editCheckIntro({ ...baseScope, ...checkScope(check) });
        setTimeline(prev => [...prev, { kind: 'intro', ui }]);
      }
    },
    [isSending, baseScope, sendMessage],
  );

  // After a beginner tested the welcome's example: the facts list, as a user
  // familiar with checks sees it, and the rest of the chat suits that level.
  // A new check, not the example.
  const showFacts = useCallback(() => {
    if (isSending) return;
    setSavedCheck(undefined);
    setExperience('experienced');
    void sendMessage(SHOW_FACTS.label, {
      newCheck: true,
      scope: { experience: 'experienced', welcome: true },
    });
  }, [isSending, sendMessage]);

  // The practice check's card, once tested: the areas, or their own check
  // in the message box, with the same hint as the new check intro's.
  const nextStep = useMemo(
    () => ({
      onShowFacts: showFacts,
      onSomethingElse: () => composer?.focus(OWN_CHECK_HINT),
    }),
    [showFacts, composer],
  );

  // The full ref ("component:default/order-api") so the agent never guesses
  // a namespace; the wording is what its test-only path recognises.
  const testOn = useCallback(
    (entityRef: string) => {
      void sendMessage(`Test it on ${entityRef}`);
    },
    [sendMessage],
  );

  // The kinds a check applies to: the save card's, or else those of its
  // facts' retrievers. Empty (Components) when it isn't limited.
  const kindsOf = useCallback(
    (appliesTo?: string[], factIds?: string[]) => {
      if (appliesTo?.length) return appliesTo;
      const ids = factIds?.length ? factIds : scope.selectedFactIds ?? [];
      return Array.from(
        new Set(
          (scope.availableFactRetrievers ?? [])
            .filter(retriever => ids.includes(retriever.id))
            .flatMap(retriever => retriever.kinds ?? []),
        ),
      );
    },
    [scope],
  );

  const renderTestPicker = useCallback(
    (card: ConfirmationRequired) => (
      <ComponentPicker
        kinds={kindsOf(card.applies_to, card.fact_ids)}
        disabled={isSending}
        onTest={testOn}
      />
    ),
    [kindsOf, isSending, testOn],
  );

  // A level picked: it sends that level's message as the chat's first, and
  // the agent answers with the welcome for the level (scope.welcome).
  const pickExperience = useCallback(
    (value: Experience) => {
      const level = EXPERIENCE_LEVELS.find(l => l.value === value);
      if (!level || isSending) return;
      setExperience(value);
      void sendMessage(level.message, {
        scope: { experience: value, welcome: true },
      });
    },
    [isSending, sendMessage],
  );

  // A save card's "Skip the test": the agent sends the card again, ready to
  // save, without a model call (card_for_save_request).
  const skipTest = useCallback(() => {
    void sendMessage('Skip the test');
  }, [sendMessage]);

  // When an external trigger (e.g. failed-build snackbar / Investigate
  // launcher) opens the drawer with a pre-seeded message, **draft it
  // into the composer** instead of auto-sending. The user reviews the
  // proposed first turn, edits if they want, and clicks Send.
  // Keyed on ``openSeq`` so the same message can be re-seeded (different
  // button click) without holding stale state.
  //
  // Conversation continuity rules:
  // - Different ``conversationKey`` (or one side undefined-vs-defined) →
  //   wipe the timeline and draft the new initialMessage into the
  //   composer. This is how switching tasks (debug build → runtime_debug)
  //   starts fresh.
  // - Same ``conversationKey`` as the last seed → preserve the timeline,
  //   leave the composer empty. The user is reopening the same chat
  //   (Continue previous) and should pick up exactly where they left off.
  // - ``resetConversation: true`` ("Start new" choice) — wipe + redraft
  //   even if the key matches.
  //
  // The first-ever open uses a sentinel for ``lastConversationKey`` so
  // it never spuriously matches ``undefined`` and blocks the initial seed.
  const lastSeededSeq = useRef<number | undefined>(undefined);
  const lastConversationKey = useRef<string | undefined | symbol>(NO_KEY_YET);
  useEffect(() => {
    if (!open) return;
    if (openSeq === undefined) return;
    if (lastSeededSeq.current === openSeq) return;
    lastSeededSeq.current = openSeq;

    const sameContext =
      lastConversationKey.current !== NO_KEY_YET &&
      lastConversationKey.current === conversationKey;
    if (sameContext && !resetConversation) {
      // Re-open of the same chat — leave the timeline alone, leave the
      // composer at whatever the user had typed.
      return;
    }
    lastConversationKey.current = conversationKey;

    // Fresh chat (or "Start new"): wipe any prior timeline / streaming /
    // error state so the user sees a clean slate, then prefill the
    // composer with the launcher's draft message.
    abortRef.current?.abort();
    turnRef.current++;
    setTimeline([]);
    setSavedCheck(undefined);
    setExperience(undefined);
    setStreaming('');
    setToolStatus(null);
    setProgress(null);
    setComposerHint(null);
    setError(null);
    // Wipe the index-keyed expander state alongside the timeline — see
    // handleClear for the rationale.
    setExpandedPrompts(new Set());
    setInput(initialMessage ?? '');
    if (initialMessage && initialMessage.trim()) {
      // Wait for the TextField to receive the new value before focusing,
      // so the cursor lands at the end of the drafted text.
      requestAnimationFrame(() => {
        const el = composerRef.current;
        if (!el) return;
        el.focus();
        const len = el.value.length;
        try {
          el.setSelectionRange(len, len);
        } catch {
          // Some browsers throw on setSelectionRange for textareas in
          // unusual states; ignore — focus alone is enough.
        }
      });
    }
  }, [open, openSeq, initialMessage, conversationKey, resetConversation]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ className: classes.drawerPaper }}
    >
      <Box className={classes.header}>
        <Typography variant="subtitle1" className={classes.headerTitle}>
          Portal Assistant
        </Typography>
        <Box>
          <Tooltip title="Clear conversation">
            <span>
              <IconButton
                size="small"
                onClick={handleClear}
                aria-label="Clear conversation"
                // Disabled when there's nothing to clear OR while a turn
                // is in flight — clearing mid-stream would abandon a
                // half-rendered assistant reply in a confused state.
                // The previous predicate (`isSending && timeline.length
                // === 0`) was unreachable: sendMessage appends the user
                // turn to the timeline BEFORE flipping isSending=true,
                // so during a send the timeline is always non-empty,
                // making the AND-pair always false and leaving the
                // button always enabled.
                disabled={isSending || timeline.length === 0}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <IconButton
            size="small"
            onClick={onClose}
            aria-label="Close assistant"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      <div className={classes.body} ref={bodyRef}>
        {/* Save cards offer a test before saving with this picker. */}
        <ConfirmCardTestPicker.Provider value={renderTestPicker}>
          <ConfirmCardSkipTest.Provider value={skipTest}>
            <ConfirmCardNextStep.Provider value={nextStep}>
              {editIntro && (
                <Box className={`${classes.message} ${classes.assistant}`}>
                  <AgentUi
                    messages={editIntro}
                    // Like the agent's cards: answerable until the chat moves on.
                    disabled={isSending || timeline.length > 0}
                    onAction={text => sendMessage(text)}
                    composer={composer}
                  />
                </Box>
              )}

              {/* A new check's first message, a card like the agent's; it
                stays at the top of the chat, read-only once it moves on. */}
              {baseScope.caseType === 'check_authoring' && !editIntro && (
                <Box className={`${classes.message} ${classes.assistant}`}>
                  <AgentUi
                    messages={newIntro}
                    disabled={isSending || timeline.length > 0}
                    // A level sends its message with the level's scope.
                    onAction={text => {
                      const level = EXPERIENCE_LEVELS.find(
                        l => l.message === text,
                      );
                      if (level) pickExperience(level.value);
                      else void sendMessage(text);
                    }}
                    composer={composer}
                  />
                </Box>
              )}

              {/* A check authoring chat opens with its level picker instead. */}
              {baseScope.caseType !== 'check_authoring' &&
                timeline.length === 0 &&
                !streaming &&
                !toolStatus && (
                  <Box className={classes.emptyState}>
                    <Typography variant="body2">
                      {(() => {
                        if (scope.caseType === 'build_failure') {
                          return (
                            <>
                              Ask anything about builds for{' '}
                              <em>{scope.component ?? 'this component'}</em> —
                              failed runs, build configuration, workflows.
                            </>
                          );
                        }
                        if (scope.caseType === 'runtime_debug') {
                          // The same empty-state copy covers both anchors —
                          // the bridge between logs and traces is the whole
                          // point of runtime_debug.
                          const subject =
                            scope.component ?? scope.project ?? 'this service';
                          return (
                            <>
                              Ask anything about runtime behaviour for{' '}
                              <em>{subject}</em> — errors, slow requests, the
                              path between a log line and the request that
                              produced it.
                            </>
                          );
                        }
                        return (
                          <>
                            Ask anything about your platform — components,
                            projects, environments.
                          </>
                        );
                      })()}
                    </Typography>
                    {(() => {
                      // Launcher-supplied chips win when present (e.g. trace
                      // launcher tailoring chips to the focused trace's
                      // metadata). Otherwise fall back to the per-caseType
                      // defaults below so the drawer still has helpful starter
                      // prompts when opened from the generic FAB.
                      //
                      // Default chips can carry a shorter ``label`` than the
                      // ``message`` that gets sent — the chip surface is narrow
                      // but the agent benefits from a fuller, less ambiguous
                      // prompt. Launcher-supplied chips stay verbatim
                      // (label === message) for back-compat with existing callers.
                      let chips: { label: string; message: string }[] = (
                        suggestions ?? []
                      ).map(s => ({ label: s, message: s }));
                      if (chips.length === 0) {
                        if (scope.caseType === 'build_failure') {
                          chips = [
                            {
                              label: 'Why did the build fail?',
                              message: 'Why did the build fail?',
                            },
                          ];
                        } else if (scope.caseType === 'runtime_debug') {
                          // runtime_debug is launched from the Logs tab today;
                          // there's no trace-anchored launcher. Per-row
                          // InvestigateLogButton can override these with
                          // pinned-log-aware suggestions.
                          //
                          // ``label === message`` is intentional — what the
                          // user sees on the chip is what lands in the chat
                          // as their turn. Earlier versions used a verbose
                          // ``message`` to give the model extra hints
                          // ("…in these logs", "…in the window"), but the
                          // runtime_debug scope now carries prefetchedLogs,
                          // logLevels, logsStartTime/End and pinnedLog* — so
                          // those hints are redundant and just bloat the
                          // visible user-turn in the drawer.
                          chips = [
                            {
                              label: 'Investigate the error',
                              message: 'Investigate the error',
                            },
                            {
                              label: 'What triggered this?',
                              message: 'What triggered this?',
                            },
                            {
                              label: 'When did this start?',
                              message: 'When did this start?',
                            },
                          ];
                        } else {
                          chips = [
                            {
                              label: 'List my components',
                              message: 'List my components',
                            },
                            {
                              label: 'Which environments are configured?',
                              message: 'Which environments are configured?',
                            },
                            {
                              label: 'Show projects in this namespace',
                              message: 'Show projects in this namespace',
                            },
                          ];
                        }
                      }
                      return (
                        <Box className={classes.suggestionStrip}>
                          {chips.map(c => (
                            <Chip
                              key={c.label}
                              label={c.label}
                              variant="outlined"
                              size="small"
                              clickable
                              className={classes.suggestionChip}
                              onClick={() => handleSuggestion(c.message)}
                            />
                          ))}
                        </Box>
                      );
                    })()}
                  </Box>
                )}

              {timeline.map((item, i) => {
                // User turns never contain an Evidence section — bypass the
                // splitter and render verbatim. For assistant turns, split
                // the diagnosis + next action from the supporting evidence
                // so the actionable bits aren't scrolled out of view by a
                // long bullet list. ``<details>`` is closed by default
                // (collapsed) — the user opts in to seeing the evidence.
                // Streaming-buffer rendering (below) deliberately skips this
                // split: while tokens are arriving the response may not yet
                // contain both opener and closer, and splitting mid-stream
                // would reflow as the closer lands. The drawer's existing
                // ``done`` handler clears the streaming buffer and the
                // message lands in the timeline where the split applies.
                //
                // A newer save card turns an unsaved one off: the check changed
                // again.
                const superseded = timeline.slice(i + 1).some(hasSave);
                if (item.kind === 'next') {
                  return (
                    <Box
                      key={`n-${i}`}
                      className={`${classes.message} ${classes.assistant}`}
                    >
                      <SavedNextStep saved={item.saved} />
                    </Box>
                  );
                }
                if (item.kind === 'intro') {
                  return (
                    <Box
                      key={`i-${i}`}
                      className={`${classes.message} ${classes.assistant}`}
                    >
                      <AgentUi
                        messages={item.ui}
                        // Like the agent's cards: answerable until the chat
                        // moves on.
                        disabled={isSending || i !== timeline.length - 1}
                        onAction={text => sendMessage(text)}
                        composer={composer}
                      />
                    </Box>
                  );
                }
                const normalised = stripEntityTags(item.content);
                if (item.role === 'user') {
                  return (
                    <Box
                      key={`m-${i}`}
                      className={`${classes.message} ${classes.user}`}
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {normalised}
                      </ReactMarkdown>
                    </Box>
                  );
                }
                const { summary, details } = splitForCollapse(normalised);
                return (
                  <Box
                    key={`m-${i}`}
                    className={`${classes.message} ${classes.assistant} ${
                      item.handedOff ? classes.handedOff : ''
                    }`}
                    {...(item.handedOff && i === timeline.length - 1
                      ? { ref: handedOffRef }
                      : {})}
                  >
                    {(() => {
                      // A change card carries the reply's sentence and the rules
                      // in plain words: it replaces the reply's text.
                      if (hasReplyCard(item.ui)) return null;
                      const parsedCheck =
                        scope.caseType === 'check_authoring'
                          ? extractCheckSections(normalised)
                          : null;
                      if (!parsedCheck) {
                        return (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {summary}
                          </ReactMarkdown>
                        );
                      }
                      if (item.confirmation) {
                        // The confirm card below shows the check, rule and
                        // suggested texts; keep only the reply's own words.
                        const words = [
                          parsedCheck.preamble?.replace(
                            /^\s*Edited rule:?\s*$/im,
                            '',
                          ),
                          parsedCheck.trailing,
                        ]
                          .map(part => part?.trim())
                          .filter(Boolean)
                          .join('\n\n');
                        return words ? (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {words}
                          </ReactMarkdown>
                        ) : null;
                      }
                      return (
                        <Box my={1}>
                          {parsedCheck.preamble && (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {parsedCheck.preamble}
                            </ReactMarkdown>
                          )}
                          {parsedCheck.name && (
                            <Box
                              display="flex"
                              alignItems="center"
                              style={{ gap: 2 }}
                            >
                              <Typography variant="body2">
                                <strong>Name:</strong> {parsedCheck.name}
                              </Typography>
                              <IconButton
                                size="small"
                                style={{ padding: 2 }}
                                aria-label="Copy name"
                                onClick={() =>
                                  handleCopyPrompt(
                                    parsedCheck.name!,
                                    'Copied — paste into the Name field',
                                  )
                                }
                              >
                                <FileCopyOutlinedIcon
                                  style={{ fontSize: 14 }}
                                />
                              </IconButton>
                            </Box>
                          )}
                          {parsedCheck.description && (
                            <Box
                              display="flex"
                              alignItems="center"
                              style={{ gap: 2 }}
                            >
                              <Typography variant="body2">
                                <strong>Description:</strong>{' '}
                                {parsedCheck.description}
                              </Typography>
                              <IconButton
                                size="small"
                                style={{ padding: 2 }}
                                aria-label="Copy description"
                                onClick={() =>
                                  handleCopyPrompt(
                                    parsedCheck.description!,
                                    'Copied — paste into the Description field',
                                  )
                                }
                              >
                                <FileCopyOutlinedIcon
                                  style={{ fontSize: 14 }}
                                />
                              </IconButton>
                            </Box>
                          )}
                          {parsedCheck.factRetriever && (
                            <Typography variant="body2">
                              <strong>
                                {parsedCheck.isSuggestedFactRetriever
                                  ? 'Suggested Fact Retriever:'
                                  : 'Fact Retriever:'}
                              </strong>{' '}
                              {parsedCheck.factRetriever}
                            </Typography>
                          )}
                          {parsedCheck.category && (
                            <Typography variant="body2">
                              <strong>Suggested Category:</strong>{' '}
                              {parsedCheck.category}
                            </Typography>
                          )}
                          {parsedCheck.maturityTier && (
                            <Typography variant="body2">
                              <strong>Suggested Maturity Tier:</strong>{' '}
                              {parsedCheck.maturityTier}
                            </Typography>
                          )}
                          {parsedCheck.ruleJson && (
                            <Box>
                              <Box
                                display="flex"
                                alignItems="center"
                                style={{ gap: 2 }}
                              >
                                <Typography variant="body2">
                                  <strong>
                                    Rule (json-rules-engine conditions)
                                  </strong>
                                </Typography>
                                <IconButton
                                  size="small"
                                  style={{ padding: 2 }}
                                  aria-label="Copy rule"
                                  onClick={() =>
                                    handleCopyPrompt(
                                      parsedCheck.ruleJson!,
                                      'Copied — paste into the Rule field',
                                    )
                                  }
                                >
                                  <FileCopyOutlinedIcon
                                    style={{ fontSize: 14 }}
                                  />
                                </IconButton>
                              </Box>
                              <Typography
                                variant="body2"
                                component="pre"
                                style={{
                                  fontFamily: 'monospace',
                                  fontSize: 12,
                                  overflowX: 'auto',
                                  margin: 0,
                                }}
                              >
                                {parsedCheck.ruleJson}
                              </Typography>
                            </Box>
                          )}
                          {parsedCheck.suggestions && (
                            <Box mt={1}>
                              <Typography variant="body2">
                                <strong>Suggested related changes</strong>
                              </Typography>
                              {parsedCheck.suggestions.map(s => (
                                <Box
                                  key={s.field}
                                  display="flex"
                                  alignItems="center"
                                  style={{ gap: 2 }}
                                >
                                  <Typography variant="body2">
                                    <strong>{s.field}:</strong>{' '}
                                    {s.from && (
                                      <>
                                        <s>{s.from}</s> →{' '}
                                      </>
                                    )}
                                    {s.to}
                                  </Typography>
                                  <IconButton
                                    size="small"
                                    style={{ padding: 2 }}
                                    aria-label={`Copy suggested ${s.field}`}
                                    onClick={() =>
                                      handleCopyPrompt(
                                        s.to,
                                        `Copied — paste into the ${s.field} field`,
                                      )
                                    }
                                  >
                                    <FileCopyOutlinedIcon
                                      style={{ fontSize: 14 }}
                                    />
                                  </IconButton>
                                </Box>
                              ))}
                            </Box>
                          )}
                          {parsedCheck.trailing && (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {parsedCheck.trailing}
                            </ReactMarkdown>
                          )}
                        </Box>
                      );
                    })()}
                    {item.ui && (
                      <AgentUi
                        messages={item.ui}
                        // Only the latest reply can be answered, and not while
                        // the next one is loading.
                        disabled={isSending || i !== timeline.length - 1}
                        superseded={superseded}
                        onAction={text => sendMessage(text)}
                        onSaved={handleSaved}
                        onOpenCheck={handleOpenCheck}
                        composer={composer}
                        renderMarkdown={text => (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {stripEntityTags(text)}
                          </ReactMarkdown>
                        )}
                      />
                    )}
                    {item.confirmation && !hasSaveCard(item.ui) && (
                      <Box mt={1}>
                        <ConfirmCard
                          card={item.confirmation}
                          onSaved={handleSaved}
                          superseded={superseded}
                        />
                      </Box>
                    )}
                    {item.fixPrompt && (
                      // Banner sits BETWEEN the summary and the <details>
                      // expander so the affordance is visible the moment the
                      // diagnosis lands — a small icon buried under
                      // "Show details" was easy to miss. Gate strictly on
                      // backend-supplied fixPrompt: build_failure turns
                      // without a code-level cause and runtime_debug turns
                      // with no actionable handoff (empty logs, trace not
                      // found) intentionally have it unset and the banner
                      // does not render. Recipient differs by case_type —
                      // build_failure targets a coding bot, runtime_debug
                      // targets an AI with the OpenChoreo MCP server +
                      // kubectl — but the rendering path is the same.
                      <>
                        <Box
                          className={`${classes.fixPromptBanner}${
                            expandedPrompts.has(i)
                              ? ` ${classes.fixPromptBannerOpen}`
                              : ''
                          }`}
                        >
                          <Box className={classes.fixPromptBannerLabel}>
                            <AndroidOutlinedIcon
                              className={classes.fixPromptBannerIcon}
                            />
                            <Typography
                              variant="caption"
                              className={classes.fixPromptBannerText}
                            >
                              Prompt for AI Agents
                            </Typography>
                          </Box>
                          <Box className={classes.fixPromptBannerActions}>
                            <Tooltip
                              title={
                                expandedPrompts.has(i)
                                  ? 'Hide prompt'
                                  : 'Show prompt'
                              }
                            >
                              <IconButton
                                size="small"
                                onClick={() => toggleExpandPrompt(i)}
                                aria-label={
                                  expandedPrompts.has(i)
                                    ? 'Hide the generated prompt'
                                    : 'Show the generated prompt'
                                }
                                className={classes.fixPromptBannerExpand}
                              >
                                {expandedPrompts.has(i) ? (
                                  <ExpandLessIcon fontSize="small" />
                                ) : (
                                  <ExpandMoreIcon fontSize="small" />
                                )}
                              </IconButton>
                            </Tooltip>
                            <Button
                              size="small"
                              color="primary"
                              onClick={() => {
                                void handleCopyPrompt(item.fixPrompt!);
                              }}
                              className={classes.fixPromptBannerButton}
                              aria-label="Copy diagnosis as a prompt for an external AI assistant"
                            >
                              Copy
                            </Button>
                          </Box>
                        </Box>
                        {expandedPrompts.has(i) && (
                          // Preview lives OUTSIDE the banner so its tinted
                          // background visually anchors to the banner above
                          // (same accent, square top corners). Rendered as
                          // markdown (same renderer as the chat messages) so the
                          // agent's backticks show as styled inline-code pills
                          // instead of literally. The Copy button above still
                          // copies the RAW fix_prompt verbatim — only this
                          // on-screen preview is prettified.
                          <Box className={classes.fixPromptPreview}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {item.fixPrompt}
                            </ReactMarkdown>
                          </Box>
                        )}
                      </>
                    )}
                    {details && (
                      // Affordance label is "Show details" (not "Show
                      // evidence") because the collapsed block holds BOTH
                      // ``**Evidence**`` bullets AND a ``**Trace bridge**``
                      // sentence. Saying "evidence" would also create a
                      // visual duplicate with the inner section label as
                      // soon as the user opens it.
                      <details className={classes.evidenceDetails}>
                        <summary className={classes.evidenceSummary}>
                          Show details
                        </summary>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {details}
                        </ReactMarkdown>
                      </details>
                    )}
                  </Box>
                );
              })}
            </ConfirmCardNextStep.Provider>
          </ConfirmCardSkipTest.Provider>
        </ConfirmCardTestPicker.Provider>

        {streaming && (
          <Box className={`${classes.message} ${classes.assistant}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {/* Use splitForStreaming so Evidence content is hidden the
                  moment its header arrives, instead of streaming in and
                  then snapping behind "Show details" once `done` lands.
                  remend() still self-heals partial markdown in the
                  visible summary so the user never sees raw `**` or
                  half-closed code fences. */}
              {stripEntityTags(remend(splitForStreaming(streaming).summary))}
            </ReactMarkdown>
          </Box>
        )}

        {/* A check authoring reply is held back until it is checked, so
            the live progress card shows what the agent is doing instead
            of the Thinking line. It sits in a reply's box, where the
            reply's card will be. */}
        {isSending &&
          !error &&
          progress &&
          scope.caseType === 'check_authoring' && (
            <Box
              className={`${classes.handoff} ${
                progress.leaving ? classes.handoffLeaving : ''
              }`}
            >
              <Box className={classes.handoffInner}>
                <Box
                  className={`${classes.message} ${classes.assistant} ${classes.liveProgress}`}
                >
                  <LiveProgressCard
                    steps={progress.steps}
                    result={progress.result}
                    startedAt={progress.startedAt}
                    ready={progress.ready}
                  />
                </Box>
              </Box>
            </Box>
          )}

        {/* "Thinking ." → "Thinking .." → "Thinking ..." sequential
            growing dots. Shown while ``isSending`` is true and no
            streamed content / error has landed. Label tracks the most
            recent tool_call's activeForm; falls back to "Thinking". */}
        {isSending &&
          !streaming &&
          !error &&
          scope.caseType !== 'check_authoring' && (
            <Box className={classes.workingIndicator}>
              <span className={classes.workingDotsLabel}>
                {toolStatus ?? 'Thinking'}
              </span>
            </Box>
          )}
        {error && <Box className={classes.errorMsg}>{error}</Box>}
      </div>

      <Box className={classes.composer}>
        <TextField
          fullWidth
          multiline
          maxRows={4}
          variant="outlined"
          size="small"
          placeholder={composerHint || 'Message Portal Assistant'}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSending}
          inputRef={composerRef}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                {isSending ? (
                  <Tooltip title="Stop">
                    <IconButton size="small" onClick={handleStop}>
                      <StopIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <Tooltip title="Send (Enter)">
                    <span>
                      <IconButton
                        size="small"
                        onClick={handleSend}
                        disabled={!input.trim()}
                      >
                        <SendIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                )}
              </InputAdornment>
            ),
          }}
        />
      </Box>
      <Snackbar
        open={copyToast !== null}
        autoHideDuration={2500}
        onClose={() => setCopyToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message={copyToast ?? ''}
      />
    </Drawer>
  );
};
