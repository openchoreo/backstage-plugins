import { useEffect, useRef } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useApi } from '@backstage/core-plugin-api';
import {
  useAssistantEnabled,
  useComponentEntityDetails,
} from '@openchoreo/backstage-plugin-react';
import { Box, Button, makeStyles } from '@material-ui/core';
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

interface LogsPageDebugPromptProps {
  /**
   * Stable callback returning the log rows currently visible on the
   * Logs tab. Called at click time so the snapshot matches the
   * user-visible state. The button forwards the result as
   * ``scope.prefetchedLogs`` so the agent can skip the first
   * ``query_component_logs`` roundtrip. Optional — when omitted the
   * agent issues its normal tool call (old behaviour).
   */
  getLogsSnapshot?: () => PrefetchableLogRow[];
}

const useStyles = makeStyles(theme => ({
  wrap: {
    position: 'fixed',
    right: theme.spacing(3),
    bottom: theme.spacing(3),
    zIndex: theme.zIndex.modal - 1,
  },
  button: {
    borderRadius: 999,
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
    textTransform: 'none',
    fontWeight: 600,
    boxShadow: theme.shadows[6],
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
    },
  },
  icon: {
    marginRight: theme.spacing(1),
    fontSize: 18,
  },
}));

/**
 * Inline "Ask Assistant" pill button on the component Logs tab. Click
 * to open the drawer with ``caseType: 'runtime_debug'`` and
 * ``runtimeAnchor: 'log'`` (plus the entity's scope and the page's
 * level / window filters) so the agent's first tool call targets
 * ``query_component_logs`` directly, then pivots to traces when a
 * ``trace_id`` token appears in the returned rows.
 */
export const LogsPageDebugPrompt = ({
  getLogsSnapshot,
}: LogsPageDebugPromptProps = {}) => {
  const classes = useStyles();
  const enabled = useAssistantEnabled();
  const { entity } = useEntity();
  const { getEntityDetails } = useComponentEntityDetails();
  const { openDrawer } = useAssistantDrawer();
  const assistantApi = useApi(perchAgentApiRef);
  // The observability plugin keeps the selected env in the URL as ``?env=…``
  // (see useUrlFiltersForRuntimeLogs in plugins/openchoreo-observability).
  // Reading it here lets the launcher pre-populate ChatScope.environment so
  // the agent doesn't have to ask the user for what's already on screen.
  const [searchParams] = useSearchParams();

  // Re-warm the per-user MCP tools cache when the Logs tab mounts. The
  // global warmup in AssistantDrawerProvider only fires once at sign-in;
  // the agent's cache has a TTL, so by the time a user lands on Logs the
  // entry may already be cold and the first chat pays the 6–9 s
  // tool-listing roundtrip. Best-effort — the API itself swallows errors.
  // Throttled so navigating between tabs doesn't fire on every remount.
  const lastWarmedAtRef = useRef<number>(0);
  const WARMUP_MIN_INTERVAL_MS = 30_000;
  const warmIfStale = () => {
    if (!enabled) return;
    const now = Date.now();
    if (now - lastWarmedAtRef.current < WARMUP_MIN_INTERVAL_MS) return;
    lastWarmedAtRef.current = now;
    void assistantApi.warmup();
  };
  useEffect(() => {
    warmIfStale();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  if (!enabled) return null;

  const entityName = entity.metadata.name;
  const kind = (entity.kind ?? '').toLowerCase();
  const isComponent = kind === 'component';
  // ``env`` URL param — the observability plugin's RuntimeLogs page sets it
  // when the user picks an environment from the dropdown. Empty when no env
  // has been selected yet (rare; the page auto-selects the first one).
  const environment = searchParams.get('env') ?? undefined;
  // Mirror what the user has on screen: log-level chips and the
  // time-range dropdown live in ``?logLevel=`` (CSV; empty string when
  // the user explicitly cleared all chips) and ``?timeRange=`` (e.g.
  // ``10m``, ``30m``, ``1h``, ``24h``, ``7d``, ``14d`` — see
  // observability/src/types.ts TIME_RANGE_OPTIONS). useUrlFiltersForRuntimeLogs
  // STRIPS these params from the URL when they equal the page defaults
  // ("10m" / all-levels), so a missing param means "page default" — NOT
  // "user has no preference". We mirror those defaults here so the
  // agent's window matches what's actually rendered, instead of falling
  // through to its own narrower 30-min ERROR-only default.
  const logLevelParam = searchParams.get('logLevel');
  const timeRangeParam = searchParams.get('timeRange') ?? '10m';
  const PAGE_DEFAULT_LEVELS = ['ERROR', 'WARN', 'INFO', 'DEBUG'];

  const handleClick = async () => {
    let namespace = resolveEntityNamespace(entity);
    let project = entityName;
    let component: string | undefined;

    if (isComponent) {
      component = entityName;
      try {
        const details = await getEntityDetails();
        namespace = details.namespaceName;
        project = details.projectName;
        component = details.componentName;
      } catch {
        // Fall back to entity metadata if relationship resolution fails.
      }
    }

    // logLevel CSV. Three cases:
    //   - URL key absent  → page default = all levels (mirror in scope so
    //                       the agent's empty-result message can't disagree
    //                       with the rendered table).
    //   - URL key present but empty string → user explicitly cleared every
    //                       chip; querying logs with zero levels is useless,
    //                       so fall back to the page default and let the
    //                       agent answer at all.
    //   - URL key present with values → use VERBATIM.
    const logLevels =
      logLevelParam === null || logLevelParam.trim().length === 0
        ? PAGE_DEFAULT_LEVELS
        : logLevelParam
            .split(',')
            .map(s => s.trim().toUpperCase())
            .filter(Boolean);

    // Convert the page's ``timeRange`` token into an absolute (start,
    // end) ISO pair in the browser — passing a duration string to the
    // LLM tempts it to compute timestamps itself, which it gets wrong
    // with alarming consistency (months-old dates leak in from training
    // data). The clock used here is the user's, which is also the one
    // driving the rendered table, so the agent's window matches exactly.
    const rangeMinutes = parseRangeToMinutes(timeRangeParam);
    let logsStartTime: string | undefined;
    let logsEndTime: string | undefined;
    if (rangeMinutes !== undefined) {
      const end = new Date();
      const start = new Date(end.getTime() - rangeMinutes * 60_000);
      logsEndTime = end.toISOString();
      logsStartTime = start.toISOString();
    }

    // Snapshot at click time (not at component mount) so the rows the
    // agent receives mirror what the user is actually looking at when
    // they click. Sliced/trimmed by buildPrefetchedLogs to fit the
    // agent's per-request content budget.
    const prefetchedLogs = getLogsSnapshot
      ? buildPrefetchedLogs(getLogsSnapshot())
      : undefined;

    // ``runtime_debug`` is the unified case_type covering both the
    // logs side and the traces side. The agent picks the log-anchored
    // sub-flow when ``runtimeAnchor === 'log'`` is set (and would
    // pick the trace sub-flow if a ``traceId`` is present in the
    // same scope).
    const overrides: Partial<ChatScope> = {
      caseType: 'runtime_debug',
      runtimeAnchor: 'log',
      namespace,
      ...(component ? { component } : {}),
      ...(project ? { project } : {}),
      ...(environment ? { environment } : {}),
      ...(logLevels && logLevels.length > 0 ? { logLevels } : {}),
      ...(logsStartTime && logsEndTime ? { logsStartTime, logsEndTime } : {}),
      ...(prefetchedLogs ? { prefetchedLogs } : {}),
    };
    openDrawer({
      initialMessage: `What's going wrong in my recent logs?`,
      scopeOverrides: overrides,
      conversationKey:
        `runtime_debug:log:${namespace}:${project ?? '-'}:` +
        `${component ?? '-'}:${environment ?? '-'}`,
    });
  };

  return (
    <Box className={classes.wrap}>
      <Button
        variant="contained"
        className={classes.button}
        disableElevation={false}
        onClick={() => {
          void handleClick();
        }}
        onMouseEnter={warmIfStale}
        onFocus={warmIfStale}
        aria-label="Ask AI about these logs"
      >
        <ChatOutlinedIcon className={classes.icon} />
        Ask AI
      </Button>
    </Box>
  );
};
