import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Drawer,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
  Typography,
  makeStyles,
} from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import SendIcon from '@material-ui/icons/Send';
import StopIcon from '@material-ui/icons/Stop';
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';
import CheckIcon from '@material-ui/icons/Check';
import { useApi } from '@backstage/core-plugin-api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  assistantAgentApiRef,
  type ChatMessage,
  type ChatScope,
  type ProposedAction,
  type StreamEvent,
} from '../../api/AssistantAgentApi';
import type { PinnedContext } from '../AssistantContext/AssistantDrawerContext';

// Module-level sentinel — a per-render symbol would never match the previous
// render's symbol, breaking the conversationKey continuity check.
const NO_KEY_YET = Symbol('no-key-yet');

const DRAWER_WIDTH = 440;

const useStyles = makeStyles(theme => ({
  drawerPaper: {
    width: DRAWER_WIDTH,
    maxWidth: '90vw',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(1.5, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  headerTitle: { fontWeight: 600 },
  body: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    padding: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  message: {
    padding: theme.spacing(1, 1.5),
    borderRadius: theme.shape.borderRadius,
    maxWidth: '90%',
    wordBreak: 'break-word',
    '& p': { margin: 0 },
    '& pre': {
      margin: theme.spacing(0.5, 0),
      padding: theme.spacing(1),
      borderRadius: theme.shape.borderRadius,
      overflowX: 'auto',
    },
  },
  user: {
    alignSelf: 'flex-end',
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
  },
  assistant: {
    alignSelf: 'flex-start',
    backgroundColor: theme.palette.background.default,
  },
  toolStatus: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontStyle: 'italic',
    color: theme.palette.text.secondary,
  },
  errorMsg: {
    alignSelf: 'stretch',
    color: theme.palette.error.main,
    fontSize: 12,
  },
  actionCard: {
    alignSelf: 'stretch',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(1.25, 1.5),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.75),
    backgroundColor: theme.palette.background.paper,
  },
  actionCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  actionTool: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: 600,
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  actionBadge: {
    fontSize: 10,
    padding: theme.spacing(0.25, 0.75),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.warning.main,
    color: theme.palette.warning.contrastText,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: 600,
  },
  actionSummary: { fontSize: 13 },
  actionArgs: {
    fontFamily: 'monospace',
    fontSize: 11,
    backgroundColor: theme.palette.action.hover,
    padding: theme.spacing(0.75, 1),
    borderRadius: theme.shape.borderRadius,
    whiteSpace: 'pre-wrap',
    maxHeight: 200,
    overflowY: 'auto',
  },
  actionButtons: {
    display: 'flex',
    gap: theme.spacing(1),
    justifyContent: 'flex-end',
  },
  actionResult: {
    fontSize: 12,
  },
  actionResultOk: { color: theme.palette.success.main },
  actionResultErr: { color: theme.palette.error.main },
  composer: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5, 2),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  emptyState: {
    margin: 'auto',
    color: theme.palette.text.secondary,
    textAlign: 'center',
    padding: theme.spacing(3),
  },
}));

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
}

export const AssistantChatDrawer = ({
  open,
  onClose,
  initialMessage,
  pin,
  scopeOverrides,
  conversationKey,
  resetConversation,
  openSeq,
}: Props) => {
  const classes = useStyles();
  const api = useApi(assistantAgentApiRef);
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
        }
      : fromPath;
    return scopeOverrides ? { ...fromPin, ...scopeOverrides } : fromPin;
  }, [location.pathname, pin, scopeOverrides]);

  // ChatItem unifies plain text turns and proposed-action cards into one
  // ordered timeline so action cards stay anchored to the turn that produced
  // them, instead of all clumping at the bottom of the drawer.
  type ActionStatus =
    | { kind: 'pending' }
    | { kind: 'running' }
    | { kind: 'done'; message: string }
    | { kind: 'error'; message: string }
    | { kind: 'dismissed' };
  type ChatItem =
    | { kind: 'message'; role: 'user' | 'assistant'; content: string }
    | { kind: 'proposal'; action: ProposedAction; status: ActionStatus };

  const [timeline, setTimeline] = useState<ChatItem[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState<string>('');
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  // Forwarded to TextField.inputRef so the seed effect can focus the
  // composer after drafting a launcher's prefilled message.
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  // Helpers — derive text-only ChatMessage history (what the backend wants)
  // from the unified timeline.
  const messageHistory: ChatMessage[] = useMemo(
    () =>
      timeline
        .filter(
          (it): it is Extract<ChatItem, { kind: 'message' }> =>
            it.kind === 'message',
        )
        .map(({ role, content }) => ({ role, content })),
    [timeline],
  );

  const abortRef = useRef<AbortController | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to the bottom on new content.
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [timeline, streaming, toolStatus]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleClear = useCallback(() => {
    abortRef.current?.abort();
    setTimeline([]);
    setStreaming('');
    setToolStatus(null);
    setError(null);
  }, []);

  const updateProposalStatus = useCallback(
    (actionId: string, next: ActionStatus) => {
      setTimeline(prev =>
        prev.map(item =>
          item.kind === 'proposal' && item.action.action_id === actionId
            ? { ...item, status: next }
            : item,
        ),
      );
    },
    [],
  );

  const ackForAction = useCallback(
    (action: ProposedAction, ok: boolean, detail?: string): string => {
      const summary =
        action.summary || `${action.tool}(${action.args.name ?? ''})`.trim();
      if (ok) {
        return `✅ Done — ${summary}`;
      }
      return `❌ Could not run *${summary}*${detail ? `: ${detail}` : ''}.`;
    },
    [],
  );

  const handleApprove = useCallback(
    async (actionId: string) => {
      updateProposalStatus(actionId, { kind: 'running' });
      const proposalItem = timeline.find(
        (it): it is Extract<ChatItem, { kind: 'proposal' }> =>
          it.kind === 'proposal' && it.action.action_id === actionId,
      );
      try {
        const result = await api.executeAction(actionId);
        updateProposalStatus(
          actionId,
          result.success
            ? { kind: 'done', message: 'Action executed successfully.' }
            : { kind: 'error', message: result.error ?? 'Execute failed.' },
        );
        if (proposalItem) {
          const ack = ackForAction(
            proposalItem.action,
            result.success,
            result.error,
          );
          setTimeline(prev => [
            ...prev,
            { kind: 'message', role: 'assistant', content: ack },
          ]);
        }
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        updateProposalStatus(actionId, { kind: 'error', message: detail });
        if (proposalItem) {
          const ack = ackForAction(proposalItem.action, false, detail);
          setTimeline(prev => [
            ...prev,
            { kind: 'message', role: 'assistant', content: ack },
          ]);
        }
      }
    },
    [api, ackForAction, timeline, updateProposalStatus],
  );

  const handleDismiss = useCallback(
    (actionId: string) => {
      updateProposalStatus(actionId, { kind: 'dismissed' });
    },
    [updateProposalStatus],
  );

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
      // a new task (build_failure → logs_debug, etc.) so context from
      // the previous task doesn't leak into the new one.
      const baseHistory: ChatMessage[] = options?.resetHistory
        ? []
        : messageHistory;
      const nextHistory: ChatMessage[] = [
        ...baseHistory,
        { role: 'user', content: trimmed },
      ];
      if (options?.resetHistory) {
        abortRef.current?.abort();
        setTimeline([userItem]);
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
                setTimeline(prev => {
                  const lastAssistant = [...prev]
                    .reverse()
                    .find(
                      it => it.kind === 'message' && it.role === 'assistant',
                    );
                  const fallback =
                    lastAssistant && lastAssistant.kind === 'message'
                      ? lastAssistant.content
                      : '';
                  return [
                    ...prev,
                    {
                      kind: 'message',
                      role: 'assistant',
                      content: event.message || fallback,
                    },
                  ];
                });
                setStreaming('');
                setToolStatus(null);
                break;
              case 'error':
                setError(event.message);
                setStreaming('');
                setToolStatus(null);
                break;
              case 'actions':
                setTimeline(prev => [
                  ...prev,
                  ...event.actions.map<ChatItem>(action => ({
                    kind: 'proposal',
                    action,
                    status: { kind: 'pending' },
                  })),
                ]);
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
  //   composer. This is how switching tasks (debug build → logs_debug)
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
          Perch
        </Typography>
        <Box>
          <Tooltip title="Clear conversation">
            <span>
              <IconButton
                size="small"
                onClick={handleClear}
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
              {scope.caseType === 'build_failure' ? (
                <>
                  Ask anything about builds for{' '}
                  <em>{scope.component ?? 'this component'}</em> — failed runs,
                  build configuration, workflows. Try:{' '}
                  <em>"Why did the latest build fail?"</em> or{' '}
                  <em>"List recent runs"</em>.
                </>
              ) : (
                <>
                  Ask anything about your platform — components, projects,
                  environments. Try: <em>"List my components"</em>.
                </>
              )}
            </Typography>
          </Box>
        )}

        {timeline.map((item, i) => {
          if (item.kind === 'message') {
            return (
              <Box
                key={`m-${i}`}
                className={`${classes.message} ${
                  item.role === 'user' ? classes.user : classes.assistant
                }`}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {item.content}
                </ReactMarkdown>
              </Box>
            );
          }
          // proposal
          if (item.status.kind === 'dismissed') return null;
          const { action, status } = item;
          return (
            <Box key={action.action_id} className={classes.actionCard}>
              <Box className={classes.actionCardHeader}>
                <span className={classes.actionTool}>{action.tool}</span>
                {action.mutating && (
                  <span className={classes.actionBadge}>write</span>
                )}
              </Box>
              {action.summary && (
                <Typography className={classes.actionSummary}>
                  {action.summary}
                </Typography>
              )}
              <pre className={classes.actionArgs}>
                {JSON.stringify(action.args, null, 2)}
              </pre>
              {status.kind === 'done' && (
                <Box
                  className={`${classes.actionResult} ${classes.actionResultOk}`}
                >
                  ✓ {status.message}
                </Box>
              )}
              {status.kind === 'error' && (
                <Box
                  className={`${classes.actionResult} ${classes.actionResultErr}`}
                >
                  ✗ {status.message}
                </Box>
              )}
              {(status.kind === 'pending' || status.kind === 'running') && (
                <Box className={classes.actionButtons}>
                  <Button
                    size="small"
                    onClick={() => handleDismiss(action.action_id)}
                    disabled={status.kind === 'running'}
                  >
                    Dismiss
                  </Button>
                  <Button
                    size="small"
                    color="primary"
                    variant="contained"
                    startIcon={
                      status.kind === 'running' ? (
                        <CircularProgress size={14} color="inherit" />
                      ) : (
                        <CheckIcon fontSize="small" />
                      )
                    }
                    onClick={() => handleApprove(action.action_id)}
                    disabled={status.kind === 'running'}
                  >
                    {status.kind === 'running' ? 'Running…' : 'Approve'}
                  </Button>
                </Box>
              )}
            </Box>
          );
        })}

        {streaming && (
          <Box className={`${classes.message} ${classes.assistant}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {streaming}
            </ReactMarkdown>
          </Box>
        )}

        {toolStatus && <Box className={classes.toolStatus}>{toolStatus}</Box>}
        {error && <Box className={classes.errorMsg}>{error}</Box>}
      </div>

      <Box className={classes.composer}>
        <TextField
          fullWidth
          multiline
          rowsMax={4}
          variant="outlined"
          size="small"
          placeholder="Message Perch…"
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
    </Drawer>
  );
};
