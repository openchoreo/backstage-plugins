import { Box, Typography, Button } from '@material-ui/core';
import Refresh from '@material-ui/icons/Refresh';
import NavigateBefore from '@material-ui/icons/NavigateBefore';
import NavigateNext from '@material-ui/icons/NavigateNext';
import { useLogsActionsStyles } from '../RuntimeLogs/styles';
import type { TriggersFilters } from './types';
import { TRIGGERS_PAGE_SIZE } from './types';

interface TriggersActionsProps {
  totalCount: number;
  disabled: boolean;
  onRefresh: () => void;
  filters: TriggersFilters;
  onFiltersChange: (filters: Partial<TriggersFilters>) => void;
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

export const TriggersActions = ({
  totalCount,
  disabled,
  onRefresh,
  filters,
  onFiltersChange,
  lastUpdated,
}: TriggersActionsProps) => {
  const classes = useLogsActionsStyles();
  const displayDate = lastUpdated || new Date();

  const page = filters.page;
  const pageSize = TRIGGERS_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startItem = totalCount === 0 ? 0 : page * pageSize + 1;
  const endItem = Math.min((page + 1) * pageSize, totalCount);

  const handlePrev = () => {
    if (page > 0) {
      onFiltersChange({ page: page - 1 });
    }
  };

  const handleNext = () => {
    if (page + 1 < totalPages) {
      onFiltersChange({ page: page + 1 });
    }
  };

  return (
    <Box className={classes.statsContainer}>
      <Box>
        <Typography variant="body2" color="textSecondary">
          Total triggers: {totalCount}
          {totalCount > 0 && (
            <> — showing {startItem}-{endItem}</>
          )}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Last updated at: {formatDate(displayDate)}
        </Typography>
      </Box>
      <Box className={classes.actionsContainer}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<NavigateBefore />}
          onClick={handlePrev}
          disabled={disabled || page === 0}
        >
          Prev
        </Button>
        <Typography variant="body2" color="textSecondary">
          Page {page + 1} / {totalPages}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          endIcon={<NavigateNext />}
          onClick={handleNext}
          disabled={disabled || page + 1 >= totalPages}
        >
          Next
        </Button>
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
