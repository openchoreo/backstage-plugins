import { FC, ChangeEvent } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  TextField,
} from '@material-ui/core';
import { Skeleton } from '@material-ui/lab';
import { TIME_RANGE_OPTIONS } from '../../types';
import { Environment } from '../../types';

export interface TracesFilters {
  searchQuery: string;
  componentId?: string;
  environmentId: string;
  timeRange: string;
}

interface TracesFilterProps {
  filters: TracesFilters;
  onFiltersChange: (filters: Partial<TracesFilters>) => void;
  environments: Environment[];
  environmentsLoading: boolean;
  disabled?: boolean;
}

export const TracesFilter: FC<TracesFilterProps> = ({
  filters,
  onFiltersChange,
  environments,
  environmentsLoading,
  disabled = false,
}) => {
  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ searchQuery: event.target.value });
  };

  const handleEnvironmentChange = (event: ChangeEvent<{ value: unknown }>) => {
    onFiltersChange({ environmentId: event.target.value as string });
  };

  const handleTimeRangeChange = (event: ChangeEvent<{ value: unknown }>) => {
    onFiltersChange({ timeRange: event.target.value as string });
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={3}>
        <TextField
          fullWidth
          label="Search Trace ID"
          variant="outlined"
          value={filters.searchQuery}
          onChange={handleSearchChange}
          placeholder="Enter Trace ID to search"
          disabled={disabled}
        />
      </Grid>

      <Grid item xs={12} md={3}>
        <FormControl fullWidth disabled={disabled}>
          <InputLabel id="components-label">Components</InputLabel>
          <Select
            value={filters.componentId}
            onChange={() => {}}
            labelId="components-label"
            label="Component"
          >
            <MenuItem value="">All Components</MenuItem>
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} md={3}>
        <FormControl fullWidth disabled={disabled || environmentsLoading}>
          <InputLabel id="environment-label">Environment</InputLabel>
          {environmentsLoading ? (
            <Skeleton variant="rect" height={56} />
          ) : (
            <Select
              value={filters.environmentId}
              onChange={handleEnvironmentChange}
              labelId="environment-label"
              label="Environment"
            >
              {environments.map(env => (
                <MenuItem key={env.uid || env.name} value={env.uid || env.name}>
                  {env.displayName || env.name}
                </MenuItem>
              ))}
            </Select>
          )}
        </FormControl>
      </Grid>

      <Grid item xs={12} md={3}>
        <FormControl fullWidth disabled={disabled}>
          <InputLabel id="time-range-label">Time Range</InputLabel>
          <Select
            value={filters.timeRange}
            onChange={handleTimeRangeChange}
            labelId="time-range-label"
            label="Time Range"
          >
            {TIME_RANGE_OPTIONS.map(option => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
    </Grid>
  );
};
