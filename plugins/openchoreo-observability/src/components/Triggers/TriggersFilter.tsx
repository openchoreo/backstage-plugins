import { FC, ChangeEvent } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
} from '@material-ui/core';
import { Skeleton } from '@material-ui/lab';
import type { TriggersFilters, Environment } from './types';
import { TRIGGERS_TIME_RANGE_OPTIONS } from './types';

interface TriggersFilterProps {
  filters: TriggersFilters;
  onFiltersChange: (filters: Partial<TriggersFilters>) => void;
  environments: Environment[];
  environmentsLoading: boolean;
  disabled?: boolean;
}

export const TriggersFilter: FC<TriggersFilterProps> = ({
  filters,
  onFiltersChange,
  environments,
  environmentsLoading,
  disabled = false,
}) => {
  const handleEnvironmentChange = (event: ChangeEvent<{ value: unknown }>) => {
    onFiltersChange({ environmentId: event.target.value as string });
  };

  const handleTimeRangeChange = (event: ChangeEvent<{ value: unknown }>) => {
    onFiltersChange({ timeRange: event.target.value as string });
  };

  const handleSortOrderChange = (event: ChangeEvent<{ value: unknown }>) => {
    onFiltersChange({ sortOrder: event.target.value as 'asc' | 'desc' });
  };

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={3}>
        <FormControl
          fullWidth
          disabled={disabled || environmentsLoading}
          variant="outlined"
        >
          <InputLabel id="triggers-environment-label">Environment</InputLabel>
          {environmentsLoading ? (
            <Skeleton variant="rect" height={56} />
          ) : (
            <Select
              value={filters.environmentId}
              onChange={handleEnvironmentChange}
              labelId="triggers-environment-label"
              label="Environment"
            >
              {environments.map(env => (
                <MenuItem key={env.id} value={env.id}>
                  {env.name}
                </MenuItem>
              ))}
            </Select>
          )}
        </FormControl>
      </Grid>

      <Grid item xs={12} md={3}>
        <FormControl fullWidth disabled={disabled} variant="outlined">
          <InputLabel id="triggers-time-range-label">Time Range</InputLabel>
          <Select
            value={filters.timeRange}
            onChange={handleTimeRangeChange}
            labelId="triggers-time-range-label"
            label="Time Range"
          >
            {TRIGGERS_TIME_RANGE_OPTIONS.map(opt => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} md={3}>
        <FormControl fullWidth disabled={disabled} variant="outlined">
          <InputLabel id="triggers-sort-label">Sort Order</InputLabel>
          <Select
            value={filters.sortOrder}
            onChange={handleSortOrderChange}
            labelId="triggers-sort-label"
            label="Sort Order"
          >
            <MenuItem value="desc">Newest First</MenuItem>
            <MenuItem value="asc">Oldest First</MenuItem>
          </Select>
        </FormControl>
      </Grid>
    </Grid>
  );
};
