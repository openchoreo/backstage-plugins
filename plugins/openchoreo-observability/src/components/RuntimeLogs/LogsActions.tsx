import { Box, Typography, Button, Tooltip } from '@material-ui/core';
import Refresh from '@material-ui/icons/Refresh';
import FiberManualRecord from '@material-ui/icons/FiberManualRecord';
import { useLogsActionsStyles } from './styles';
import { RuntimeLogsFilters } from './types';
import ArrowUpward from '@material-ui/icons/ArrowUpward';
import ArrowDownward from '@material-ui/icons/ArrowDownward';

interface LogsActionsProps {
  totalCount: number;
  disabled: boolean;
  onRefresh: () => void;
  filters: RuntimeLogsFilters;
  onFiltersChange: (filters: Partial<RuntimeLogsFilters>) => void;
  lastUpdated?: Date;
}

const formatDate = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
};

export const LogsActions = ({
  totalCount,
  disabled,
  onRefresh,
  filters,
  onFiltersChange,
  lastUpdated,
}: LogsActionsProps) => {
  const classes = useLogsActionsStyles();

  const effectiveSortOrder = filters.sortOrder || 'desc';
  const handleSortToggle = () => {
    const newSortOrder = effectiveSortOrder === 'desc' ? 'asc' : 'desc';
    onFiltersChange({ sortOrder: newSortOrder });
  };

  const handleLiveToggle = () => {
    onFiltersChange({ isLive: !filters.isLive });
  };

  const displayDate = lastUpdated || new Date();

  return (
    <Box className={classes.statsContainer}>
      <Box>
        <Typography variant="body2" color="textSecondary">
          Total logs: {totalCount}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Last updated at: {formatDate(displayDate)}
        </Typography>
      </Box>
      <Box className={classes.actionsContainer}>
        <Tooltip
          title={
            effectiveSortOrder === 'desc'
              ? 'Sort Logs by Newest First'
              : 'Sort Logs by Oldest First'
          }
        >
          <Button
            variant="outlined"
            onClick={handleSortToggle}
            disabled={disabled}
            size="small"
            startIcon={
              effectiveSortOrder === 'desc' ? (
                <ArrowUpward />
              ) : (
                <ArrowDownward />
              )
            }
          >
            {effectiveSortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
          </Button>
        </Tooltip>
        <Tooltip
          title={filters.isLive ? 'Stop Live Updates' : 'Start Live Updates'}
        >
          <Button
            variant="outlined"
            onClick={handleLiveToggle}
            disabled={disabled}
            size="small"
            startIcon={
              <FiberManualRecord
                style={{
                  color: filters.isLive ? '#4caf50' : 'inherit',
                  fontSize: '12px',
                }}
              />
            }
          >
            Live
          </Button>
        </Tooltip>
        <Tooltip title="Refresh">
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={onRefresh}
            disabled={disabled}
            size="small"
          >
            Refresh
          </Button>
        </Tooltip>
      </Box>
    </Box>
  );
};
