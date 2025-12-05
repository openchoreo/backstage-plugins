import { FC, ChangeEvent } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
} from '@material-ui/core';
import { Skeleton } from '@material-ui/lab';
import { Filters, TIME_RANGE_OPTIONS } from '../../types';
import { Environment } from '../../types';
import { Component } from '../../hooks/useGetComponentsByProject';

interface TracesFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Partial<Filters>) => void;
  environments: Environment[];
  environmentsLoading: boolean;
  components: Component[];
  componentsLoading: boolean;
  disabled?: boolean;
}

export const TracesFilters: FC<TracesFiltersProps> = ({
  filters,
  onFiltersChange,
  environments,
  environmentsLoading,
  components,
  componentsLoading,
  disabled = false,
}) => {
  const handleEnvironmentChange = (event: ChangeEvent<{ value: unknown }>) => {
    const selectedEnvironment = environments.find(
      env => env.uid === (event.target.value as string),
    );
    if (selectedEnvironment) {
      onFiltersChange({ environment: selectedEnvironment });
    }
  };

  const handleComponentChange = (event: ChangeEvent<{ value: unknown }>) => {
    onFiltersChange({ componentIds: [event.target.value as string] });
  };

  const handleTimeRangeChange = (event: ChangeEvent<{ value: unknown }>) => {
    onFiltersChange({ timeRange: event.target.value as string });
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={3}>
        {/* TODO: Implement search trace ID filter
        <TextField
          fullWidth
          label="Search Trace ID"
          variant="outlined"
          value={filters.searchQuery}
          onChange={handleSearchChange}
          placeholder="Enter Trace ID to search"
          disabled={disabled}
        /> */}
      </Grid>

      <Grid item xs={12} md={3}>
        <FormControl fullWidth disabled={disabled || componentsLoading}>
          <InputLabel id="components-label">Components</InputLabel>
          {componentsLoading ? (
            <Skeleton variant="rect" height={56} />
          ) : (
            <Select
              value={filters.componentIds?.[0] || ''}
              onChange={handleComponentChange}
              labelId="components-label"
              label="Component"
            >
              {components.map(component => (
                <MenuItem
                  key={component.uid || component.name}
                  value={component.uid || component.name}
                >
                  {component.displayName || component.name}
                </MenuItem>
              ))}
            </Select>
          )}
        </FormControl>
      </Grid>

      <Grid item xs={12} md={3}>
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
