import {
  memo,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Box, IconButton, Tooltip } from '@material-ui/core';
import FileCopyOutlined from '@material-ui/icons/FileCopyOutlined';
import { useAuditResultPillStyles, useAuditRowStyles } from './styles';
import { getAuditColumnStyle } from './columns';
import { AuditLogRecord } from './types';
import {
  absoluteTime,
  actorInitials,
  relativeAge,
  scopeSegments,
  shortUserAgent,
} from './format';

export interface AuditEventRowProps {
  record: AuditLogRecord;
  /** Column ids to render, in order. */
  columns: string[];
  selected: boolean;
  onSelect: (eventId: string) => void;
}

const Absent = ({ text = '—' }: { text?: string }) => {
  const classes = useAuditRowStyles();
  return <span className={classes.absent}>{text}</span>;
};

/**
 * One audit record as a row of the virtualized table.
 *
 * Memoized on its props: the virtualizer re-renders the window on every scroll
 * tick, and a page of 100 records with fifteen columns is enough work that
 * re-rendering unchanged rows shows up as scroll jank.
 */
export const AuditEventRow = memo(function AuditEventRow({
  record,
  columns,
  selected,
  onSelect,
}: AuditEventRowProps) {
  const classes = useAuditRowStyles();
  const pills = useAuditResultPillStyles();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>(
    'idle',
  );

  const resource = record.resource ?? undefined;

  const avatarByActorType: Record<string, string> = {
    service_account: classes.avatarService,
    anonymous: classes.avatarAnonymous,
  };

  const COPY_TITLES: Record<typeof copyState, string> = {
    idle: 'Copy record JSON',
    copied: 'Copied',
    failed: 'Copy failed',
  };

  // A result this client predates gets no pill styling rather than borrowing
  // another outcome's, which would misreport it.
  const pillClass = pills[record.result as keyof typeof pills] ?? '';

  // Cleared on unmount: rows are recycled constantly under virtualization, so
  // a pending reset would land on a row that no longer exists.
  const resetTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const handleCopy = async (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(JSON.stringify(record, null, 2));
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopyState('idle'), 1600);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(record.event_id);
    }
  };

  const cell = (id: string, content: ReactNode) => (
    <Box
      key={id}
      role="cell"
      style={getAuditColumnStyle(id)}
      className={classes.cell}
    >
      {content}
    </Box>
  );

  const renderCell = (id: string) => {
    switch (id) {
      case 'time':
        return cell(
          id,
          <>
            <div className={classes.timeAbs}>
              {absoluteTime(record.event_time)}
            </div>
            <div className={classes.timeRel}>
              {relativeAge(record.event_time)}
            </div>
          </>,
        );
      case 'actor':
        return cell(
          id,
          <div className={classes.actor}>
            <span
              aria-hidden="true"
              className={`${classes.avatar} ${
                avatarByActorType[record.actor.type] ?? ''
              }`}
            >
              {actorInitials(record.actor)}
            </span>
            <div style={{ minWidth: 0 }}>
              <div className={classes.actorId} title={record.actor.id}>
                {record.actor.id}
              </div>
              <div className={classes.subtle}>
                {record.actor.type.replace(/_/g, ' ')}
              </div>
            </div>
          </div>,
        );
      case 'action':
        return cell(
          id,
          record.action ? (
            <span className={classes.mono}>{record.action}</span>
          ) : (
            // action carries no omitempty, so a rejection publishes it as an
            // empty string rather than omitting it — say why it is blank.
            <Absent text="no action resolved" />
          ),
        );
      case 'resource':
        return cell(
          id,
          resource?.name ? (
            <>
              <div className={classes.actorId} title={resource.name}>
                {resource.name}
              </div>
              <div className={classes.subtle}>{resource.type}</div>
            </>
          ) : (
            <Absent />
          ),
        );
      case 'scope': {
        const segments = scopeSegments(resource);
        return cell(
          id,
          segments.length === 0 ? (
            <Absent text={resource?.type ? 'cluster-scoped' : '—'} />
          ) : (
            <div className={classes.scope} title={segments.join(' / ')}>
              {segments.map((segment, index) => (
                <span key={segment + String(index)}>
                  {index > 0 && (
                    <span className={classes.scopeSeparator}>/</span>
                  )}
                  {segment}
                </span>
              ))}
            </div>
          ),
        );
      }
      case 'result':
        return cell(
          id,
          <span className={`${classes.pill} ${pillClass}`}>
            {record.result}
          </span>,
        );
      case 'surface':
        return cell(
          id,
          record.surface ? (
            <span className={classes.mono}>{record.surface}</span>
          ) : (
            <Absent />
          ),
        );
      case 'category':
        return cell(
          id,
          record.category ? (
            <span className={classes.mono}>{record.category}</span>
          ) : (
            <Absent />
          ),
        );
      case 'operation':
        return cell(
          id,
          record.operation_id ? (
            <span className={classes.mono} title={record.operation_id}>
              {record.operation_id}
            </span>
          ) : (
            <Absent />
          ),
        );
      case 'environment':
        return cell(
          id,
          resource?.environment ? (
            <span className={classes.mono} title={resource.environment}>
              {resource.environment}
            </span>
          ) : (
            <Absent />
          ),
        );
      case 'producer':
        return cell(
          id,
          record.producer ? (
            <span className={classes.mono}>{record.producer}</span>
          ) : (
            <Absent />
          ),
        );
      case 'request':
        return cell(
          id,
          record.request_id ? (
            <span className={classes.mono} title={record.request_id}>
              {record.request_id}
            </span>
          ) : (
            <Absent />
          ),
        );
      case 'ip':
        return cell(
          id,
          record.source_ip ? (
            <span className={classes.mono}>{record.source_ip}</span>
          ) : (
            <Absent />
          ),
        );
      case 'ua':
        return cell(
          id,
          record.user_agent ? (
            <span className={classes.mono} title={record.user_agent}>
              {shortUserAgent(record.user_agent)}
            </span>
          ) : (
            <Absent />
          ),
        );
      case 'http':
        return cell(
          id,
          record.http?.path ? (
            <div className={classes.truncate} title={record.http.path}>
              <span className={classes.verb}>{record.http.method}</span>
              <span className={classes.mono} style={{ display: 'inline' }}>
                {record.http.path}
              </span>
            </div>
          ) : (
            <Absent />
          ),
        );
      default:
        return null;
    }
  };

  return (
    <div
      role="row"
      tabIndex={0}
      aria-selected={selected}
      className={`${classes.row} ${selected ? classes.rowSelected : ''}`}
      onClick={() => onSelect(record.event_id)}
      onKeyDown={handleKeyDown}
    >
      {columns.map(renderCell)}
      <Box
        role="cell"
        style={getAuditColumnStyle('actions')}
        className={`${classes.cell} ${classes.actionsCell}`}
      >
        <Tooltip title={COPY_TITLES[copyState]}>
          <IconButton
            size="small"
            className={classes.copyButton}
            aria-label="Copy record JSON"
            onClick={handleCopy}
          >
            <FileCopyOutlined fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </div>
  );
});
