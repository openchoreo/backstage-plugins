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
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import { useApi } from '@backstage/core-plugin-api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remend from 'remend';
import {
  perchAgentApiRef,
  type ChatMessage,
  type ChatScope,
  type StreamEvent,
} from '../../api/PerchAgentApi';
import type { PinnedContext } from '../AssistantContext/AssistantDrawerContext';
import { useStyles } from './styles';
import { splitForCollapse, splitForStreaming } from './splitForCollapse';

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
  openSeq,
}: Props) => {
  const classes = useStyles();
  const api = useApi(perchAgentApiRef);
  const location = useLocation();

  // Recompute scope on every navigation; old conversations stay readable
  // but new turns use the latest scope. The pinned context (if any)
  // overrides URL-derived component/namespace so an explicit pin always wins.
  // scopeOverrides is applied last and wins over everything.
  const scope = useMemo(() => {
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
    return scopeOverrides ? { ...fromPin, ...scopeOverrides } : fromPin;
  }, [location.pathname, pin, scopeOverrides]);

  // The agent is read-only — every timeline item is a plain user / assistant
  // message. The unified-item shape is kept (rather than ChatMessage[])
  // so future non-message variants can slot in without restructuring.
  //
  // ``fixPrompt`` is set ONLY on assistant items when the agent's
  // terminal DoneEvent carried a ``fix_prompt`` field (build_failure
  // turns with a code-level cause). The drawer uses its presence to
  // gate the per-message "Copy as prompt" affordance — the frontend
  // never synthesises this; it copies the backend payload verbatim.
  type ChatItem = {
    kind: 'message';
    role: 'user' | 'assistant';
    content: string;
    fixPrompt?: string;
  };

  const [timeline, setTimeline] = useState<ChatItem[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState<string>('');
  const [toolStatus, setToolStatus] = useState<string | null>(null);
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

  // Helpers — derive text-only ChatMessage history (what the backend wants)
  // from the unified timeline.
  const messageHistory: ChatMessage[] = useMemo(
    () => timeline.map(({ role, content }) => ({ role, content })),
    [timeline],
  );

  const abortRef = useRef<AbortController | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to the bottom on new content.
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [timeline, streaming, toolStatus, error]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleClear = useCallback(() => {
    abortRef.current?.abort();
    setTimeline([]);
    setStreaming('');
    setToolStatus(null);
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
  const handleCopyPrompt = useCallback(async (prompt: string) => {
    try {
      // Prefer the async Clipboard API (only available on secure
      // contexts — https + localhost). Fall back to the legacy
      // execCommand path so http-served Backstage instances still
      // work — the textarea is briefly mounted off-screen so the
      // user never sees it.
      let succeeded = false;
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
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
        setCopyToast('Copied — paste into your AI coding assistant');
      } else {
        setCopyToast('Copy failed — please copy manually');
      }
    } catch (e) {
      setCopyToast(
        `Copy failed: ${e instanceof Error ? e.message : 'unknown error'}`,
      );
    }
  }, []);

  const sendMessage = useCallback(
    async (rawText: string, options?: { resetHistory?: boolean }) => {
      const trimmed = rawText.trim();
      if (!trimmed || isSending) return;

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
      setStreaming('');
      setToolStatus(null);
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await api.streamChat(
          {
            messages: nextHistory,
            scope: Object.keys(scope).length > 0 ? scope : undefined,
          },
          (event: StreamEvent) => {
            switch (event.type) {
              case 'message_chunk':
                setStreaming(prev => prev + event.content);
                setToolStatus(null);
                break;
              case 'tool_call':
                setToolStatus(event.activeForm ?? `Running ${event.tool}…`);
                break;
              case 'done':
                if (typeof event.message === 'string' && event.message !== '') {
                  setTimeline(prev => [
                    ...prev,
                    {
                      kind: 'message',
                      role: 'assistant',
                      content: event.message,
                      // Snake_case on the wire (matches the backend's
                      // DoneEvent field). Only set on build_failure
                      // turns where the agent surfaced a code-level
                      // cause; absent for everything else.
                      fixPrompt: event.fix_prompt || undefined,
                    },
                  ]);
                }
                setStreaming('');
                setToolStatus(null);
                break;
              case 'error':
                setError(event.message);
                setStreaming('');
                setToolStatus(null);
                break;
              default:
                break;
            }
          },
          controller.signal,
        );
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err.message);
        }
      } finally {
        setIsSending(false);
        abortRef.current = null;
      }
    },
    [api, isSending, messageHistory, scope],
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
    setTimeline([]);
    setStreaming('');
    setToolStatus(null);
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
        {timeline.length === 0 && !streaming && !toolStatus && (
          <Box className={classes.emptyState}>
            <Typography variant="body2">
              {(() => {
                if (scope.caseType === 'build_failure') {
                  return (
                    <>
                      Ask anything about builds for{' '}
                      <em>{scope.component ?? 'this component'}</em> — failed
                      runs, build configuration, workflows.
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
                      <em>{subject}</em> — errors, slow requests, the path
                      between a log line and the request that produced it.
                    </>
                  );
                }
                return (
                  <>
                    Ask anything about your platform — components, projects,
                    environments.
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
              className={`${classes.message} ${classes.assistant}`}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {summary}
              </ReactMarkdown>
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
                          expandedPrompts.has(i) ? 'Hide prompt' : 'Show prompt'
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

        {/* "Thinking ." → "Thinking .." → "Thinking ..." sequential
            growing dots. Shown while ``isSending`` is true and no
            streamed content / error has landed. Label tracks the most
            recent tool_call's activeForm; falls back to "Thinking". */}
        {isSending && !streaming && !error && (
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
          placeholder="Message Portal Assistant"
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
