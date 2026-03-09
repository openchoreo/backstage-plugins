import { Box, Typography, Button, Tooltip } from '@material-ui/core';
import Refresh from '@material-ui/icons/Refresh';
import ArrowUpward from '@material-ui/icons/ArrowUpward';
import ArrowDownward from '@material-ui/icons/ArrowDownward';
import { useLogsActionsStyles } from '../RuntimeLogs/styles';
import type { IncidentsFilters } from './types';

interface IncidentsActionsProps {
  totalCount: number;
  disabled: boolean;
  onRefresh: () => void;
  filters: IncidentsFilters;
  onFiltersChange: (filters: Partial<IncidentsFilters>) => void;
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

export const IncidentsActions = ({
  totalCount,
  disabled,
  onRefresh,
  filters,
  onFiltersChange,
  lastUpdated,
}: IncidentsActionsProps) => {
  const classes = useLogsActionsStyles();
  const displayDate = lastUpdated || new Date();

  const effectiveSortOrder = filters.sortOrder || 'desc';
  const handleSortToggle = () => {
    const newSortOrder = effectiveSortOrder === 'desc' ? 'asc' : 'desc';
    onFiltersChange({ sortOrder: newSortOrder });
  };

  return (
    <Box className={classes.statsContainer}>
      <Box>
        <Typography variant="body2" color="textSecondary">
          Total incidents: {totalCount}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Last updated at: {formatDate(displayDate)}
        </Typography>
      </Box>
      <Box className={classes.actionsContainer}>
        <Tooltip
          title={
            effectiveSortOrder === 'desc'
              ? 'Sort incidents by newest first'
              : 'Sort incidents by oldest first'
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
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={onRefresh}
          disabled={disabled}
          size="small"
        >
          Refresh
        </Button>
      </Box>
    </Box>
  );
};
