import { ChangeEvent } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
} from '@material-ui/core';
import { Skeleton } from '@material-ui/lab';
import {
  Filters,
  TIME_RANGE_OPTIONS,
  RCA_STATUS_OPTIONS,
  RCAStatus,
} from '../../types';
import { Environment } from '../../types';

interface RCAFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Partial<Filters>) => void;
  environments: Environment[];
  environmentsLoading: boolean;
  disabled?: boolean;
}

export const RCAFilters = ({
  filters,
  onFiltersChange,
  environments,
  environmentsLoading,
  disabled = false,
}: RCAFiltersProps) => {
  const handleEnvironmentChange = (event: ChangeEvent<{ value: unknown }>) => {
    const selectedEnvironment = environments.find(
      env => env.uid === (event.target.value as string),
    );
    if (selectedEnvironment) {
      onFiltersChange({ environment: selectedEnvironment });
    }
  };

  const handleTimeRangeChange = (event: ChangeEvent<{ value: unknown }>) => {
    onFiltersChange({ timeRange: event.target.value as string });
  };

  const handleStatusChange = (event: ChangeEvent<{ value: unknown }>) => {
    const value = event.target.value as string;
    onFiltersChange({ rcaStatus: value ? (value as RCAStatus) : undefined });
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={4}>
        <FormControl fullWidth disabled={disabled || environmentsLoading}>
          <InputLabel id="environment-label">Environment</InputLabel>
          {environmentsLoading ? (
            <Skeleton variant="rect" height={56} />
          ) : (
            <Select
              value={filters.environment?.uid || ''}
              onChange={handleEnvironmentChange}
              labelId="environment-label"
              label="Environment"
            >
              {environments.map((env: Environment) => (
                <MenuItem key={env.uid || env.name} value={env.uid || env.name}>
                  {env.displayName || env.name}
                </MenuItem>
              ))}
            </Select>
          )}
        </FormControl>
      </Grid>

      <Grid item xs={12} md={4}>
        <FormControl fullWidth disabled={disabled}>
          <InputLabel id="status-label">Status</InputLabel>
          <Select
            value={filters.rcaStatus || ''}
            onChange={handleStatusChange}
            labelId="status-label"
            label="Status"
          >
            <MenuItem value="">All</MenuItem>
            {RCA_STATUS_OPTIONS.map(option => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} md={4}>
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
