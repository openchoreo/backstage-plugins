import { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Collapse from '@material-ui/core/Collapse';
import IconButton from '@material-ui/core/IconButton';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { makeStyles } from '@material-ui/core/styles';
import Alert from '@material-ui/lab/Alert';
import {
  InfoCard,
  Progress,
  ResponseErrorPanel,
} from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { dynamicChecksApiRef } from '../../api/DynamicChecksApi';
import type { FactCollector } from '../../api/types';
import { useEntityLabel } from '../../kinds';
import {
  NOT_ALLOWED_TOOLTIP,
  useCheckPermissions,
} from '../useCheckPermissions';
import { useCodeStyles } from '../codeStyles';
import { RelativeTime } from '../RelativeTime';
import {
  CollectorInfoButton,
  useCoveredKindsText,
} from './CollectorInfoButton';

const POLL_INTERVAL_MS = 3000;
// A little over the scheduler's default 5 minute task timeout.
const POLL_TIMEOUT_MS = 6 * 60 * 1000;

const useStyles = makeStyles(theme => ({
  expandIcon: {
    transition: theme.transitions.create('transform'),
  },
  expanded: {
    transform: 'rotate(180deg)',
  },
}));

interface PendingCollection {
  since: number;
  /** `lastRunEndedAt` when Collect now was pressed; a change means done. */
  previousRunEndedAt?: string;
}

export interface FactCollectorsPanelProps {
  /** Called after a collection started from this panel has finished. */
  onCollected?: () => void;
}

/**
 * Lists the scheduled fact retrievers with their schedule and last/next run,
 * and lets the viewer start a collection immediately. Starts collapsed to a
 * one-line summary of the collectors; clicking the header toggles it. Schedules are
 * read-only: they come from platform configuration
 * (`techInsights.factRetrievers.<id>.cadence`).
 */
export function FactCollectorsPanel(props: FactCollectorsPanelProps) {
  const { onCollected } = props;
  const classes = useStyles();
  const codeClasses = useCodeStyles();
  const api = useApi(dynamicChecksApiRef);
  const { canManage } = useCheckPermissions();
  const coveredKinds = useCoveredKindsText();
  const entityLabel = useEntityLabel();
  const [expanded, setExpanded] = useState(false);

  const [collectors, setCollectors] = useState<FactCollector[]>();
  const [loadError, setLoadError] = useState<Error>();
  const [pending, setPending] = useState<Record<string, PendingCollection>>({});
  const [notice, setNotice] = useState<{
    severity: 'info' | 'warning' | 'error';
    message: string;
  }>();

  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const onCollectedRef = useRef(onCollected);
  onCollectedRef.current = onCollected;

  const load = useCallback(async () => {
    try {
      const list = await api.listFactCollectors();
      setCollectors(list);
      setLoadError(undefined);
      return list;
    } catch (e) {
      setLoadError(e as Error);
      return undefined;
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const hasPending = Object.keys(pending).length > 0;
  // Each poll starts only after the previous one has finished, so a slow
  // backend can't stack requests up, and a run that never reports back stops
  // being polled after the timeout even while the list can't be loaded.
  useEffect(() => {
    if (!hasPending) {
      return undefined;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      const list = await load();
      if (cancelled) {
        return;
      }
      const finished: string[] = [];
      const timedOut: string[] = [];
      for (const [id, entry] of Object.entries(pendingRef.current)) {
        const collector = list?.find(c => c.id === id);
        if (
          collector?.status === 'idle' &&
          collector.lastRunEndedAt !== entry.previousRunEndedAt
        ) {
          finished.push(id);
        } else if (Date.now() - entry.since > POLL_TIMEOUT_MS) {
          timedOut.push(id);
        }
      }
      const done = [...finished, ...timedOut];
      if (done.length > 0) {
        setPending(current => {
          const next = { ...current };
          done.forEach(id => delete next[id]);
          return next;
        });
      }
      if (timedOut.length > 0) {
        setNotice({
          severity: 'warning',
          message: `No finished run seen for ${timedOut.join(
            ', ',
          )}; check the backend logs.`,
        });
      }
      if (finished.length > 0) {
        onCollectedRef.current?.();
      }
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };
    timer = setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [hasPending, load]);

  async function handleCollect(collector: FactCollector) {
    setNotice(undefined);
    try {
      const result = await api.triggerFactCollector(collector.id);
      if (result === 'already-running') {
        setNotice({
          severity: 'info',
          message: `${collector.id} is already collecting; its results appear when that run finishes.`,
        });
      }
      setPending(current => ({
        ...current,
        [collector.id]: {
          since: Date.now(),
          previousRunEndedAt: collector.lastRunEndedAt,
        },
      }));
    } catch (e) {
      setNotice({ severity: 'error', message: (e as Error).message });
    }
  }

  if (loadError && !collectors) {
    return <ResponseErrorPanel error={loadError} />;
  }

  const collectingCount = (collectors ?? []).filter(
    c => c.status === 'running' || !!pending[c.id],
  ).length;
  const lastCollected = (collectors ?? [])
    .map(c => c.lastRunEndedAt)
    .filter((iso): iso is string => !!iso)
    .sort()
    .pop();

  let summary;
  if (expanded) {
    summary = `Facts are collected on a schedule set in platform configuration. Collect now refreshes a source for every ${entityLabel.singular} it covers.`;
  } else if (collectors && collectors.length > 0) {
    // One span: the card's subheader is a flex container, which drops the
    // space between a text node and a sibling element.
    summary = (
      <span>
        {collectors.length}{' '}
        {collectors.length === 1 ? 'collector' : 'collectors'}
        {lastCollected && (
          <>
            , last collected <RelativeTime iso={lastCollected} />
          </>
        )}
        {collectingCount > 0 && `, ${collectingCount} collecting now`}
      </span>
    );
  } else if (collectors) {
    summary = 'No fact collectors are scheduled.';
  }

  return (
    <InfoCard
      title="Data sources"
      subheader={summary}
      noPadding
      divider={expanded || !!notice}
      headerStyle={{ cursor: 'pointer' }}
      headerProps={{ onClick: () => setExpanded(open => !open) }}
      action={
        <IconButton
          aria-label={expanded ? 'Hide data sources' : 'Show data sources'}
          aria-expanded={expanded}
          onClick={event => {
            event.stopPropagation();
            setExpanded(open => !open);
          }}
        >
          <ExpandMoreIcon
            className={`${classes.expandIcon} ${
              expanded ? classes.expanded : ''
            }`}
          />
        </IconButton>
      }
    >
      {notice && (
        <Box px={2} pt={2} pb={expanded ? 0 : 2}>
          <Alert severity={notice.severity}>{notice.message}</Alert>
        </Box>
      )}
      <Collapse in={expanded}>
        <Box p={2}>
          {!collectors && <Progress />}
          {collectors && collectors.length === 0 && (
            <Typography variant="body2" color="textSecondary">
              No fact collectors are scheduled.
            </Typography>
          )}
          {collectors && collectors.length > 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Collector</TableCell>
                  <TableCell>Collects for</TableCell>
                  <TableCell>Schedule</TableCell>
                  <TableCell>Last Collected</TableCell>
                  <TableCell>Next Run</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {collectors.map(collector => {
                  const collecting =
                    collector.status === 'running' || !!pending[collector.id];
                  return (
                    <TableRow key={collector.id}>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          {collector.id}
                          <CollectorInfoButton schema={collector.schema} />
                        </Box>
                      </TableCell>
                      <TableCell>{coveredKinds(collector.schema)}</TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          className={codeClasses.code}
                        >
                          {collector.cadence ?? '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <RelativeTime iso={collector.lastRunEndedAt} />
                      </TableCell>
                      <TableCell>
                        {collector.status === 'running' ? (
                          'Running now'
                        ) : (
                          <RelativeTime iso={collector.nextRunAt} />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title={canManage ? '' : NOT_ALLOWED_TOOLTIP}>
                          <span>
                            <Button
                              size="small"
                              variant="outlined"
                              color="primary"
                              disabled={collecting || !canManage}
                              startIcon={
                                collecting ? (
                                  <CircularProgress size={14} />
                                ) : (
                                  <AutorenewIcon fontSize="small" />
                                )
                              }
                              onClick={() => handleCollect(collector)}
                            >
                              {collecting ? 'Collecting…' : 'Collect now'}
                            </Button>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Box>
      </Collapse>
    </InfoCard>
  );
}
