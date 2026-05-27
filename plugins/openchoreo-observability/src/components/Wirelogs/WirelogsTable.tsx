import { FC, UIEvent, useLayoutEffect, useRef, useState } from 'react';
import {
  Box,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@material-ui/core';
import { useWirelogsTableStyles } from './styles';
import { WirelogsFlowDrawer } from './WirelogsFlowDrawer';
import {
  directionInfo,
  endpointMeta,
  flowSummary,
  formatTime,
  getDestinationPort,
  getSourcePort,
  typeLabel,
} from './flowFormat';
import type {
  WirelogEndpoint,
  WirelogEvent,
  WirelogFlow,
  WirelogVerdict,
} from './types';

interface WirelogsTableProps {
  flows: WirelogEvent[];
  isStreaming: boolean;
}

function rowKey(event: WirelogEvent): string {
  if (event.flow.uuid) return event.flow.uuid;
  return `${event.flow.time ?? ''}:${event.flow.source?.pod_name ?? ''}:${
    event.flow.destination?.pod_name ?? ''
  }`;
}

const VerdictCell: FC<{ verdict: WirelogVerdict | undefined }> = ({
  verdict,
}) => {
  const classes = useWirelogsTableStyles();
  const labels: Record<string, string> = {
    DROPPED: 'Dropped',
    FORWARDED: 'Forwarded',
  };
  const label = (verdict && labels[verdict]) || verdict || 'Unknown';
  let variantClass = classes.verdictUnknownChip;
  if (verdict === 'DROPPED') {
    variantClass = classes.verdictDroppedChip;
  } else if (verdict === 'FORWARDED') {
    variantClass = classes.verdictForwardedChip;
  }
  return (
    <Chip
      size="small"
      className={`${classes.verdictChip} ${variantClass}`}
      label={
        <>
          <span className={classes.verdictDot} />
          {label}
        </>
      }
    />
  );
};

const DirCell: FC<{ flow: WirelogFlow }> = ({ flow }) => {
  const classes = useWirelogsTableStyles();
  const { label, direction } = directionInfo(flow);
  if (direction === 'unknown') {
    return <span className={classes.dirCell}>—</span>;
  }
  return (
    <span className={classes.dirCell}>
      <span className={classes.dirArrow}>
        {direction === 'out' ? '←' : '→'}
      </span>
      {label}
    </span>
  );
};

const EndpointCell: FC<{ endpoint: WirelogEndpoint | undefined }> = ({
  endpoint,
}) => {
  const classes = useWirelogsTableStyles();
  const meta = endpointMeta(endpoint);
  return (
    <Box>
      <Box className={classes.endpointName} title={meta.name}>
        {meta.name ?? '—'}
      </Box>
      {meta.namespace && (
        <Box className={classes.endpointSub} title={meta.namespace}>
          {meta.namespace}
        </Box>
      )}
    </Box>
  );
};

function methodClass(
  method: string | undefined,
  classes: ReturnType<typeof useWirelogsTableStyles>,
): string {
  switch ((method ?? '').toUpperCase()) {
    case 'GET':
      return classes.methodGet;
    case 'POST':
      return classes.methodPost;
    case 'PUT':
    case 'PATCH':
      return classes.methodPut;
    case 'DELETE':
      return classes.methodDelete;
    default:
      return classes.methodOther;
  }
}

function statusClass(
  code: number | undefined,
  classes: ReturnType<typeof useWirelogsTableStyles>,
): string {
  const bucket = code ? Math.floor(code / 100) : 0;
  switch (bucket) {
    case 2:
      return classes.status2xx;
    case 3:
      return classes.status3xx;
    case 4:
      return classes.status4xx;
    case 5:
      return classes.status5xx;
    default:
      return classes.statusCode;
  }
}

const SummaryCell: FC<{ flow: WirelogFlow }> = ({ flow }) => {
  const classes = useWirelogsTableStyles();
  const summary = flowSummary(flow);

  if (summary.kind === 'l7-request') {
    return (
      <span className={classes.summaryCell}>
        <span
          className={`${classes.methodBadge} ${methodClass(
            summary.method,
            classes,
          )}`}
        >
          {summary.method ?? 'HTTP'}
        </span>
        <span className={classes.summaryText} title={summary.path}>
          {summary.path ?? ''}
        </span>
      </span>
    );
  }

  if (summary.kind === 'l7-response') {
    return (
      <span className={classes.summaryCell}>
        <span className={classes.summaryArrow}>←</span>
        reply
        {summary.code !== undefined && (
          <span
            className={`${classes.statusCode} ${statusClass(
              summary.code,
              classes,
            )}`}
          >
            {summary.code}
          </span>
        )}
        {summary.latency && (
          <span className={classes.summaryText}>{summary.latency}</span>
        )}
      </span>
    );
  }

  if (summary.kind === 'l4') {
    const flagPart = summary.flags.length
      ? ` [${summary.flags.join(',')}]`
      : '';
    return (
      <span className={classes.summaryCell}>
        <span className={classes.summaryText}>
          {summary.protocol}
          {summary.port ? ` :${summary.port}` : ''}
          {flagPart}
        </span>
      </span>
    );
  }

  return (
    <span className={classes.summaryCell}>
      <span className={classes.summaryText}>{summary.text ?? '—'}</span>
    </span>
  );
};

const WirelogsRow: FC<{
  event: WirelogEvent;
  selected: boolean;
  onSelect: () => void;
}> = ({ event, selected, onSelect }) => {
  const classes = useWirelogsTableStyles();
  const flow = event.flow;

  return (
    <TableRow
      className={`${classes.row} ${selected ? classes.rowSelected : ''}`}
      onClick={onSelect}
      hover
    >
      <TableCell className={`${classes.bodyCell} ${classes.timeCell}`}>
        {formatTime(flow.time)}
      </TableCell>
      <TableCell className={classes.bodyCell}>
        <VerdictCell verdict={flow.verdict} />
      </TableCell>
      <TableCell className={classes.bodyCell}>
        <span className={classes.typeBadge}>{typeLabel(flow)}</span>
      </TableCell>
      <TableCell className={classes.bodyCell}>
        <DirCell flow={flow} />
      </TableCell>
      <TableCell className={classes.bodyCell}>
        <EndpointCell endpoint={flow.source} />
      </TableCell>
      <TableCell className={classes.bodyCell}>
        <EndpointCell endpoint={flow.destination} />
      </TableCell>
      <TableCell className={classes.bodyCell}>
        <SummaryCell flow={flow} />
      </TableCell>
    </TableRow>
  );
};

export const WirelogsTable: FC<WirelogsTableProps> = ({
  flows,
  isStreaming,
}) => {
  const classes = useWirelogsTableStyles();
  const [selected, setSelected] = useState<WirelogEvent | null>(null);
  const selectedKey = selected ? rowKey(selected) : null;

  // tail -f-style auto-scroll: stick to the bottom while the user is at (or
  // near) the bottom; leave them alone once they scroll up to read older rows.
  const containerRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 40;
  };

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [flows]);

  return (
    <>
      <Paper variant="outlined" className={classes.tablePaper}>
        {flows.length === 0 ? (
          <Box className={classes.emptyState}>
            <Typography variant="body2">
              {isStreaming
                ? 'Waiting for traffic… flows will appear here as they arrive.'
                : 'Press Start stream to begin observing Cilium Hubble flows.'}
            </Typography>
          </Box>
        ) : (
          <div
            ref={containerRef}
            className={classes.tableContainer}
            onScroll={handleScroll}
          >
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell className={classes.headerCell}>Time</TableCell>
                  <TableCell className={classes.headerCell}>Verdict</TableCell>
                  <TableCell className={classes.headerCell}>Type</TableCell>
                  <TableCell className={classes.headerCell}>
                    Direction
                  </TableCell>
                  <TableCell className={classes.headerCell}>Source</TableCell>
                  <TableCell className={classes.headerCell}>
                    Destination
                  </TableCell>
                  <TableCell className={classes.headerCell}>Summary</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {flows.map(event => {
                  const key = rowKey(event);
                  return (
                    <WirelogsRow
                      key={key}
                      event={event}
                      selected={key === selectedKey}
                      onSelect={() => setSelected(event)}
                    />
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Paper>

      <WirelogsFlowDrawer event={selected} onClose={() => setSelected(null)} />
    </>
  );
};

/**
 * Filters a flow list against a free-text search query (pod names, IPs, flow ID).
 * Exported here so the parent page can drive client-side filtering without
 * re-deriving search logic per consumer.
 */
export function matchesSearch(event: WirelogEvent, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  const flow: WirelogFlow = event.flow;
  const haystack = [
    flow.uuid,
    flow.verdict,
    flow.source?.pod_name,
    flow.destination?.pod_name,
    flow.source?.namespace,
    flow.destination?.namespace,
    flow.IP?.source,
    flow.IP?.destination,
    flow.l7?.http?.method,
    flow.l7?.http?.url,
    flow.l7?.http?.code !== undefined ? String(flow.l7.http.code) : undefined,
    String(getSourcePort(flow.l4) ?? ''),
    String(getDestinationPort(flow.l4) ?? ''),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}
