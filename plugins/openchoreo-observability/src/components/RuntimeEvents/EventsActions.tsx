import { useMemo } from 'react';
import { Box, Typography, Button, Tooltip } from '@material-ui/core';
import Refresh from '@material-ui/icons/Refresh';
import FiberManualRecord from '@material-ui/icons/FiberManualRecord';
import ArrowUpward from '@material-ui/icons/ArrowUpward';
import ArrowDownward from '@material-ui/icons/ArrowDownward';
import { useEventsActionsStyles } from './styles';
import { RuntimeEventsFilters } from './types';

interface EventsActionsProps {
  totalCount: number;
  disabled: boolean;
  onRefresh: () => void;
  filters: RuntimeEventsFilters;
  onFiltersChange: (filters: Partial<RuntimeEventsFilters>) => void;
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

export const EventsActions = ({
  totalCount,
  disabled,
  onRefresh,
  filters,
  onFiltersChange,
  lastUpdated,
}: EventsActionsProps) => {
  const classes = useEventsActionsStyles();

  const effectiveSortOrder = filters.sortOrder || 'desc';
  const handleSortToggle = () => {
    const newSortOrder = effectiveSortOrder === 'desc' ? 'asc' : 'desc';
    onFiltersChange({ sortOrder: newSortOrder });
  };

  const handleLiveToggle = () => {
    onFiltersChange({ isLive: !filters.isLive });
  };

  const fallbackDate = useMemo(() => new Date(), []);
  const displayDate = lastUpdated ?? fallbackDate;

  return (
    <Box className={classes.statsContainer}>
      <Box>
        <Typography variant="body2" color="textSecondary">
          Total events: {totalCount}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Last updated at: {formatDate(displayDate)}
        </Typography>
      </Box>
      <Box className={classes.actionsContainer}>
        <Tooltip
          title={
            effectiveSortOrder === 'desc'
              ? 'Sort Events by Newest First'
              : 'Sort Events by Oldest First'
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
