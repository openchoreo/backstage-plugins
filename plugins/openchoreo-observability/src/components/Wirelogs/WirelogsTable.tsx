import { FC, useState } from 'react';
import { Box, Chip, Paper, Typography } from '@material-ui/core';
import { VirtualizedLogList } from '@openchoreo/backstage-plugin-react';
import { useWirelogsTableStyles } from './styles';
import { getColumnStyle, WirelogsColumn } from './columns';
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

// Matches the height the table scroll area used to have.
const WIRELOGS_HEIGHT = 'calc(100vh - 320px)';

const HEADER_COLUMNS: { key: WirelogsColumn; label: string }[] = [
  { key: 'time', label: 'Time' },
  { key: 'verdict', label: 'Verdict' },
  { key: 'type', label: 'Type' },
  { key: 'direction', label: 'Direction' },
  { key: 'source', label: 'Source' },
  { key: 'destination', label: 'Destination' },
  { key: 'summary', label: 'Summary' },
];

function rowKey(event: WirelogEvent): string {
  if (event.flow.uuid) return event.flow.uuid;
  if (event.__id) return event.__id;
  return `${event.flow.time ?? ''}:${event.flow.source?.pod_name ?? ''}:${
    event.flow.destination?.pod_name ?? ''
  }`;
}

// The cell helpers below take a `classes` prop instead of calling
// useWirelogsTableStyles themselves. Calling makeStyles once per cell per row
// (verdict + direction + endpoint × 2 + summary = 5 calls per row, on top of
// WirelogsRow's own call) adds up under tail -f streaming; passing the
// already-resolved classes object keeps it to one hook call per row.
type WirelogsClasses = ReturnType<typeof useWirelogsTableStyles>;

const VerdictCell: FC<{
  verdict: WirelogVerdict | undefined;
  classes: WirelogsClasses;
}> = ({ verdict, classes }) => {
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

const DirCell: FC<{ flow: WirelogFlow; classes: WirelogsClasses }> = ({
  flow,
  classes,
}) => {
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

const EndpointCell: FC<{
  endpoint: WirelogEndpoint | undefined;
  classes: WirelogsClasses;
}> = ({ endpoint, classes }) => {
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
  classes: WirelogsClasses,
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
  classes: WirelogsClasses,
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

const SummaryCell: FC<{ flow: WirelogFlow; classes: WirelogsClasses }> = ({
  flow,
  classes,
}) => {
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

interface WirelogsRowProps {
  event: WirelogEvent;
  selected: boolean;
  onSelect: () => void;
}

const WirelogsRow: FC<WirelogsRowProps> = ({ event, selected, onSelect }) => {
  const classes = useWirelogsTableStyles();
  const flow = event.flow;

  return (
    <Box
      className={`${classes.row} ${selected ? classes.rowSelected : ''}`}
      onClick={onSelect}
      role="row"
    >
      <Box className={classes.rowMain}>
        <Box
          style={getColumnStyle('time')}
          className={`${classes.bodyCellDiv} ${classes.timeCell}`}
        >
          {formatTime(flow.time)}
        </Box>
        <Box style={getColumnStyle('verdict')} className={classes.bodyCellDiv}>
          <VerdictCell verdict={flow.verdict} classes={classes} />
        </Box>
        <Box style={getColumnStyle('type')} className={classes.bodyCellDiv}>
          <span className={classes.typeBadge}>{typeLabel(flow)}</span>
        </Box>
        <Box
          style={getColumnStyle('direction')}
          className={classes.bodyCellDiv}
        >
          <DirCell flow={flow} classes={classes} />
        </Box>
        <Box style={getColumnStyle('source')} className={classes.bodyCellDiv}>
          <EndpointCell endpoint={flow.source} classes={classes} />
        </Box>
        <Box
          style={getColumnStyle('destination')}
          className={classes.bodyCellDiv}
        >
          <EndpointCell endpoint={flow.destination} classes={classes} />
        </Box>
        <Box style={getColumnStyle('summary')} className={classes.bodyCellDiv}>
          <SummaryCell flow={flow} classes={classes} />
        </Box>
      </Box>
    </Box>
  );
};

export const WirelogsTable: FC<WirelogsTableProps> = ({
  flows,
  isStreaming,
}) => {
  const classes = useWirelogsTableStyles();
  const [selected, setSelected] = useState<WirelogEvent | null>(null);
  const selectedKey = selected ? rowKey(selected) : null;

  const header = (
    <Box className={classes.headerRow} role="row">
      {HEADER_COLUMNS.map(col => (
        <Box
          key={col.key}
          role="columnheader"
          style={getColumnStyle(col.key)}
          className={classes.headerColumn}
        >
          {col.label}
        </Box>
      ))}
    </Box>
  );

  return (
    <>
      <Paper
        variant="outlined"
        className={classes.tablePaper}
        role="table"
        aria-label="Wirelogs"
      >
        {flows.length === 0 ? (
          <Box className={classes.emptyState}>
            <Typography variant="body2">
              {isStreaming
                ? 'Waiting for traffic… flows will appear here as they arrive.'
                : 'Press Start stream to begin observing Cilium Hubble flows.'}
            </Typography>
          </Box>
        ) : (
          <VirtualizedLogList
            itemCount={flows.length}
            maxHeight={WIRELOGS_HEIGHT}
            estimatedRowHeight={36}
            // `followTail` replaces the previous manual `stickToBottom` logic
            // — when streaming and the user is already at the bottom, new
            // rows auto-scroll the viewport (tail -f style); the moment the
            // user scrolls up to read older rows, follow pauses.
            followTail={isStreaming}
            getItemKey={index => rowKey(flows[index])}
            header={header}
            renderRow={index => {
              const event = flows[index];
              const key = rowKey(event);
              return (
                <WirelogsRow
                  event={event}
                  selected={key === selectedKey}
                  onSelect={() => setSelected(event)}
                />
              );
            }}
          />
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
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
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
