import { useRef } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useAssistantEnabled } from '@openchoreo/backstage-plugin-react';
import { IconButton, Tooltip, makeStyles } from '@material-ui/core';
import ChatOutlinedIcon from '@material-ui/icons/ChatOutlined';
import { useSearchParams } from 'react-router-dom';
import { perchAgentApiRef, type ChatScope } from '../../api/PerchAgentApi';
import { useAssistantDrawer } from '../AssistantContext/AssistantDrawerContext';
import {
  buildPrefetchedLogs,
  parseRangeToMinutes,
  resolveEntityNamespace,
  type PrefetchableLogRow,
} from '../../utils/scope';

/**
 * Subset of the observability ``ComponentLogEntry`` shape — only the
 * fields the button reads. Inlined (not imported from the observability
 * plugin) so this plugin stays free of cross-plugin type imports; the
 * structural typing is loose enough that any observability log row
 * satisfies it.
 */
export interface LogRowForInvestigation {
  timestamp?: string;
  log?: string;
  level?: string;
  metadata?: {
    namespaceName?: string;
    projectName?: string;
    componentName?: string;
    environmentName?: string;
  };
}

interface InvestigateLogButtonProps {
  log: LogRowForInvestigation;
  /**
   * Stable callback returning the log rows currently visible on the
   * Logs tab. Called at click time so the snapshot reflects the
   * latest state (rather than the rows captured at button mount).
   * The button forwards the result as ``scope.prefetchedLogs`` so the
   * agent can skip the first ``query_component_logs`` roundtrip.
   * Optional — when omitted the agent falls back to its normal tool
   * call, preserving the old behaviour.
   */
  getLogsSnapshot?: () => PrefetchableLogRow[];
}

const useStyles = makeStyles(theme => ({
  // Same hover-button feel as the row's Copy icon — minimal, inheriting
  // the table-cell's hover affordance instead of introducing a stand-out
  // visual that would compete with the row text.
  button: {
    padding: theme.spacing(0.5),
    marginLeft: theme.spacing(0.5),
  },
  icon: {
    fontSize: 16,
  },
}));

// W3C and ad-hoc trace_id patterns we recognise in log text. The
// frameworks we've seen in practice are: opentelemetry (W3C
// ``traceparent``), Go's slog/zerolog (``trace_id=<hex>``), Python
// structlog (``trace_id="<hex>"``). All three normalise to the same
// 16-32 hex-character id.
//
// We don't try to be exhaustive — a miss here just means the agent
// falls back to time-window correlation, which still works.
function extractTraceId(text: string | undefined): string | undefined {
  if (!text) return undefined;
  // W3C traceparent: version-traceid-parentid-flags
  const tp =
    /traceparent[=:]\s*"?(\d{2}-[a-f0-9]{32}-[a-f0-9]{16}-[a-f0-9]{2})/i.exec(
      text,
    );
  if (tp) return tp[1].split('-')[1];
  // Generic key=value with optional quoting.
  const kv = /\btrace[_-]?id[=:]\s*"?([a-f0-9]{16,32})\b/i.exec(text);
  if (kv) return kv[1];
  return undefined;
}

/**
 * Compact "Investigate" icon button rendered inside each log row's
 * hover-action column. Click opens the Perch drawer with
 * ``caseType: 'runtime_debug'`` + ``runtimeAnchor: 'log'`` and the
 * pinned-log fields populated from this row, so the agent's first
 * tool call is targeted at *this specific log line* instead of the
 * page-wide log window.
 *
 * When a ``trace_id`` token is present in the row's text, the button
 * also pins it as ``pinnedLogTraceId`` — the agent then goes straight
 * to the trace getter without re-querying the log table.
 */
export const InvestigateLogButton = ({
  log,
  getLogsSnapshot,
}: InvestigateLogButtonProps) => {
  const classes = useStyles();
  const enabled = useAssistantEnabled();
  const { entity } = useEntity();
  const { openDrawer } = useAssistantDrawer();
  const assistantApi = useApi(perchAgentApiRef);
  const [searchParams] = useSearchParams();

  // Re-warm the per-user MCP tools cache on hover/focus. Mirrors the
  // pattern in LogsPageDebugPrompt: the provider-level warmup at sign-in
  // goes stale over time, and the Investigate button is the actual
  // logs-page chat entry today. No mount-time warmup here — 50 rows
  // would each fire a useEffect; the throttle would gate the network
  // calls but the wasted effects are still pointless. Hover is enough.
  const lastWarmedAtRef = useRef<number>(0);
  const WARMUP_MIN_INTERVAL_MS = 30_000;
  const warmIfStale = () => {
    if (!enabled) return;
    const now = Date.now();
    if (now - lastWarmedAtRef.current < WARMUP_MIN_INTERVAL_MS) return;
    lastWarmedAtRef.current = now;
    void assistantApi.warmup();
  };

  if (!enabled) return null;

  const pinnedTraceId = extractTraceId(log.log);
  const tooltip = pinnedTraceId
    ? `Investigate this log line (trace ${pinnedTraceId.slice(0, 8)}…)`
    : 'Investigate this log line with Perch';

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    // Don't toggle the row's expand affordance — the parent <TableRow>
    // has an onClick handler that flips the expansion state. Stopping
    // propagation keeps the click scoped to this button.
    event.stopPropagation();

    // Row metadata (resolved by the observer from the log indexer) is the
    // most authoritative source; fall back to the entity-derived
    // namespace when the indexer didn't tag the row.
    const namespace =
      log.metadata?.namespaceName ?? resolveEntityNamespace(entity);

    const entityKind = (entity.kind ?? '').toLowerCase();
    const isComponent = entityKind === 'component';
    const project =
      log.metadata?.projectName ??
      (isComponent ? undefined : entity.metadata.name);
    const component =
      log.metadata?.componentName ??
      (isComponent ? entity.metadata.name : undefined);
    const environment =
      log.metadata?.environmentName ?? searchParams.get('env') ?? undefined;

    // Window from the URL (same parsing as LogsPageDebugPrompt). The
    // agent uses this to widen the search around the pinned row when
    // it pivots to query_component_logs for siblings or to a trace's
    // window. Missing URL param → page default = 10m.
    const timeRangeParam = searchParams.get('timeRange') ?? '10m';
    const rangeMinutes = parseRangeToMinutes(timeRangeParam) ?? 10;
    const end = new Date();
    const start = new Date(end.getTime() - rangeMinutes * 60_000);
    const logsStartTime = start.toISOString();
    const logsEndTime = end.toISOString();

    // Severity filter mirrors the page so the agent's "siblings of
    // this row" query doesn't exclude rows the user can already see.
    // Defaults to all four levels when the URL has no key (page
    // default = all selected).
    const logLevelParam = searchParams.get('logLevel');
    const logLevels =
      logLevelParam === null || logLevelParam.trim().length === 0
        ? ['ERROR', 'WARN', 'INFO', 'DEBUG']
        : logLevelParam
            .split(',')
            .map(s => s.trim().toUpperCase())
            .filter(Boolean);

    // Truncate to keep the request body small — the prompt clamps to
    // 300 chars anyway, but giving the agent the first 500 chars of
    // the line covers the common case where the actionable text is
    // near the front (level, message, request_id) without bloating
    // the per-request size budget.
    const pinnedLogMessage = log.log ? log.log.slice(0, 500) : undefined;

    // Snapshot at click time (not at button mount) so the rows we
    // forward match what the user is actually staring at when they
    // click Investigate. Sliced/trimmed by buildPrefetchedLogs.
    //
    // Pass pinned context to the helper so it narrows the snapshot to
    // rows useful for diagnosing *this specific line*: drops
    // INFO/DEBUG noise, keeps only rows within ±2 min of the pinned
    // timestamp, always preserves the pinned row itself, and promotes
    // trace-linked rows. Without this, a page with all four level
    // chips selected would ship ~50 INFO request access logs that
    // drown out the actual ERROR/WARN siblings.
    const prefetchedLogs = getLogsSnapshot
      ? buildPrefetchedLogs(getLogsSnapshot(), {
          pin: {
            timestamp: log.timestamp,
            message: pinnedLogMessage,
            traceId: pinnedTraceId,
          },
        })
      : undefined;

    const overrides: Partial<ChatScope> = {
      caseType: 'runtime_debug',
      runtimeAnchor: 'log',
      namespace,
      ...(project ? { project } : {}),
      ...(component ? { component } : {}),
      ...(environment ? { environment } : {}),
      logLevels,
      logsStartTime,
      logsEndTime,
      ...(log.timestamp ? { pinnedLogTimestamp: log.timestamp } : {}),
      ...(pinnedLogMessage ? { pinnedLogMessage } : {}),
      ...(pinnedTraceId ? { pinnedLogTraceId: pinnedTraceId } : {}),
      ...(prefetchedLogs ? { prefetchedLogs } : {}),
    };

    // Per-row conversationKey so re-opening the drawer on the same
    // log line preserves history, but a different line wipes and
    // re-seeds. The trace id is included when present because the
    // same line cannot have two trace ids; using the timestamp +
    // trace id as the per-row identity is stable.
    const conversationKey = pinnedTraceId
      ? `runtime_debug:log:${namespace}:${project ?? '-'}:${component ?? '-'}:${
          environment ?? '-'
        }:tr:${pinnedTraceId}`
      : `runtime_debug:log:${namespace}:${project ?? '-'}:${component ?? '-'}:${
          environment ?? '-'
        }:t:${log.timestamp ?? '-'}`;

    openDrawer({
      scopeOverrides: overrides,
      conversationKey,
    });
  };

  return (
    <Tooltip title={tooltip}>
      <IconButton
        className={classes.button}
        onClick={handleClick}
        onMouseEnter={warmIfStale}
        onFocus={warmIfStale}
        size="small"
        aria-label="Investigate this log line with Perch"
      >
        <ChatOutlinedIcon className={classes.icon} />
      </IconButton>
    </Tooltip>
  );
};
