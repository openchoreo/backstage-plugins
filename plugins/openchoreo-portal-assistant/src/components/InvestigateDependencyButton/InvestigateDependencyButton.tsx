import { useRef } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { useAssistantEnabled } from '@openchoreo/backstage-plugin-react';
import { Button, Tooltip, makeStyles } from '@material-ui/core';
import ChatOutlinedIcon from '@material-ui/icons/ChatOutlined';
import {
  perchAgentApiRef,
  type ChatScope,
  type ChatCaseType,
} from '../../api/PerchAgentApi';
import { useAssistantDrawer } from '../AssistantContext/AssistantDrawerContext';

interface InvestigateDependencyButtonProps {
  /** Control-plane namespace of the *dependent* (pending) component. */
  namespace?: string;
  /** Project of the dependent component. */
  project?: string;
  /** The dependent component that is stuck NotReady. */
  component?: string;
  /** Environment the binding is in (e.g. ``development``). */
  environment?: string;
  /**
   * Which assistant flow to launch. Defaults to ``dependency_pending``
   * (the connections-pending case). Pass ``runtime_debug`` for a generic
   * failed/unhealthy component so the seed message and prompt aren't
   * framed as "stuck pending".
   */
  caseType?: ChatCaseType;
  /**
   * Human-readable deployment status (e.g. ``Pending`` / ``Failed``).
   * When provided (with a component), the drawer opens showing a
   * status-aware suggestion chip — "Why is <comp>'s <env> deployment
   * <status>?" — instead of pre-drafting a generic prompt.
   */
  status?: string;
}

const useStyles = makeStyles(theme => ({
  button: {
    textTransform: 'none',
    color: theme.palette.warning.main,
    borderColor: theme.palette.warning.main,
  },
  icon: {
    fontSize: 16,
  },
}));

/**
 * "Investigate" button shown in the K8s-artifacts header when a component
 * is stuck NotReady because an outbound endpoint connection can't resolve.
 *
 * Clicking opens the Perch drawer with ``caseType: 'dependency_pending'``
 * and the pending dependencies pinned, so the agent explains why the
 * depended-on component is down (undeployed / not ready) and how to
 * recover — the detail the static artifacts view can't infer.
 *
 * Renders ``null`` when the assistant feature flag is off, so the caller
 * can mount it unconditionally.
 */
export const InvestigateDependencyButton = ({
  namespace,
  project,
  component,
  environment,
  caseType,
  status,
}: InvestigateDependencyButtonProps) => {
  const classes = useStyles();
  const enabled = useAssistantEnabled();
  const { openDrawer } = useAssistantDrawer();
  const assistantApi = useApi(perchAgentApiRef);

  // Re-warm the per-user MCP tools cache on hover/focus — same throttle as
  // InvestigateLogButton. The provider-level warmup at sign-in goes stale,
  // and this is a real chat entry point on the Deploy tab.
  const lastWarmedAtRef = useRef<number>(0);
  const WARMUP_MIN_INTERVAL_MS = 30_000;
  const warmIfStale = () => {
    if (!enabled) return;
    const now = Date.now();
    if (now - lastWarmedAtRef.current < WARMUP_MIN_INTERVAL_MS) return;
    lastWarmedAtRef.current = now;
    // Best-effort: swallow rejections so a failed warm-up never surfaces as
    // an unhandled promise rejection. A cache miss on first chat is fine.
    void assistantApi.warmup().catch(() => {});
  };

  if (!enabled) return null;

  const handleClick = () => {
    const resolvedCaseType: ChatCaseType = caseType ?? 'dependency_pending';

    const overrides: Partial<ChatScope> = {
      caseType: resolvedCaseType,
      ...(namespace ? { namespace } : {}),
      ...(project ? { project } : {}),
      ...(component ? { component } : {}),
      ...(environment ? { environment } : {}),
    };

    // Stable per-binding key so re-opening on the same env preserves the
    // thread, but switching env/component/case re-seeds.
    const conversationKey = `${resolvedCaseType}:${namespace ?? '-'}:${
      project ?? '-'
    }:${component ?? '-'}:${environment ?? '-'}`;

    // When we know the component + a human-readable status, open the drawer
    // showing a status-aware suggestion chip the user clicks to start (chips
    // send verbatim on click). Plain text — chips don't render markdown.
    const statusText = status?.trim();
    if (component && statusText) {
      const envPart = environment ? `${environment} ` : '';
      const primary = `Why is ${component}'s ${envPart}deployment ${statusText}?`;
      const followUp =
        resolvedCaseType === 'dependency_pending'
          ? 'Which dependency is it waiting on?'
          : 'What is the root cause?';
      openDrawer({
        scopeOverrides: overrides,
        conversationKey,
        suggestions: [primary, followUp],
      });
      return;
    }

    // Fallback (e.g. K8s-artifacts header, no status passed): pre-draft a
    // prompt into the composer. "stuck pending" reads wrong for a failure,
    // so frame by case.
    const where = environment ? ` in \`${environment}\`` : '';
    const subject = component ? `\`${component}\`` : 'this component';
    const initialMessage =
      resolvedCaseType === 'dependency_pending'
        ? `Why is ${subject}${where} stuck pending?`
        : `What's wrong with ${subject}${where}?`;

    openDrawer({ initialMessage, scopeOverrides: overrides, conversationKey });
  };

  return (
    <Tooltip title="Investigate this with Portal Assistant">
      <Button
        variant="outlined"
        size="small"
        className={classes.button}
        startIcon={<ChatOutlinedIcon className={classes.icon} />}
        onClick={handleClick}
        onMouseEnter={warmIfStale}
        onFocus={warmIfStale}
        aria-label="Investigate this with Portal Assistant"
      >
        Investigate with AI
      </Button>
    </Tooltip>
  );
};
