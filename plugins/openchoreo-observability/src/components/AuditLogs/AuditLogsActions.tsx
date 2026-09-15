import { Box, Button, Tooltip, Typography } from '@material-ui/core';
import ArrowDownward from '@material-ui/icons/ArrowDownward';
import ArrowUpward from '@material-ui/icons/ArrowUpward';
import FiberManualRecord from '@material-ui/icons/FiberManualRecord';
import Refresh from '@material-ui/icons/Refresh';
import { AuditColumnsPicker } from './AuditColumnsPicker';
import { useAuditActionsStyles } from './styles';
import { AuditSortOrder } from './types';
import { formatTotal, fullTime } from './format';

export interface AuditLogsActionsProps {
  total: number;
  /** Records currently loaded, which is a page or more of `total`. */
  loaded: number;
  sortOrder: AuditSortOrder;
  onSortOrderChange: (next: AuditSortOrder) => void;
  isLive: boolean;
  onLiveChange: (next: boolean) => void;
  onRefresh: () => void;
  lastUpdated?: Date;
  columns: string[];
  onColumnsChange: (columns: string[]) => void;
  disabled?: boolean;
}

export const AuditLogsActions = ({
  total,
  loaded,
  sortOrder,
  onSortOrderChange,
  isLive,
  onLiveChange,
  onRefresh,
  lastUpdated,
  columns,
  onColumnsChange,
  disabled = false,
}: AuditLogsActionsProps) => {
  const classes = useAuditActionsStyles();
  const newestFirst = sortOrder === 'desc';

  return (
    <Box className={classes.statsContainer}>
      <Box>
        <Typography variant="body2" color="textSecondary">
          Total events: {formatTotal(total)}
          {loaded > 0 && loaded < total
            ? ` · ${loaded.toLocaleString()} loaded`
            : ''}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Last updated at: {fullTime((lastUpdated ?? new Date()).toISOString())}
        </Typography>
      </Box>
      <Box className={classes.actionsContainer}>
        <Tooltip
          title={
            newestFirst
              ? 'Sort events by Newest First'
              : 'Sort events by Oldest First'
          }
        >
          <Button
            variant="outlined"
            size="small"
            disabled={disabled}
            startIcon={newestFirst ? <ArrowUpward /> : <ArrowDownward />}
            onClick={() => onSortOrderChange(newestFirst ? 'asc' : 'desc')}
          >
            {newestFirst ? 'Newest First' : 'Oldest First'}
          </Button>
        </Tooltip>
        <Tooltip
          title={
            isLive
              ? 'Stop Live Updates'
              : 'Poll the newest page every 10 seconds. Loading more pages is paused while Live is on.'
          }
        >
          <Button
            variant="outlined"
            size="small"
            disabled={disabled}
            aria-pressed={isLive}
            startIcon={
              <FiberManualRecord
                className={`${classes.liveDot} ${
                  isLive ? classes.liveDotOn : ''
                }`}
              />
            }
            onClick={() => onLiveChange(!isLive)}
          >
            Live
          </Button>
        </Tooltip>
        <Tooltip title="Refresh">
          <Button
            variant="outlined"
            size="small"
            disabled={disabled}
            startIcon={<Refresh />}
            onClick={onRefresh}
          >
            Refresh
          </Button>
        </Tooltip>
        {/* Columns picks what the table below shows, so it belongs with the
            other controls over that table rather than with the query. */}
        <AuditColumnsPicker
          columns={columns}
          onChange={onColumnsChange}
          disabled={disabled}
        />
      </Box>
    </Box>
  );
};
