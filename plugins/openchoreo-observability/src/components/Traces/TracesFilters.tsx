import { FC, ChangeEvent } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  TextField,
  Checkbox,
} from '@material-ui/core';
import { Skeleton } from '@material-ui/lab';
import { Filters, TIME_RANGE_OPTIONS } from '../../types';
import { Environment } from '../../types';
import { Component } from '../../hooks/useGetComponentsByProject';
import { useDebouncedSearch } from '../../hooks/useDebouncedSearch';

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
  const [searchInput, handleSearchChange] = useDebouncedSearch(
    filters.searchQuery,
    value => onFiltersChange({ searchQuery: value }),
    500,
  );

  const handleEnvironmentChange = (event: ChangeEvent<{ value: unknown }>) => {
    const selectedEnvironment = environments.find(
      env => env.uid === (event.target.value as string),
    );
    if (selectedEnvironment) {
      onFiltersChange({ environment: selectedEnvironment });
    }
  };

  const handleComponentChange = (event: ChangeEvent<{ value: unknown }>) => {
    const value = event.target.value as string[];
    onFiltersChange({ components: value });
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
          value={searchInput}
          onChange={handleSearchChange}
          placeholder="Enter Trace ID to search"
          disabled={disabled}
        />
      </Grid>

      <Grid item xs={12} md={3}>
        <FormControl
          fullWidth
          disabled={disabled || componentsLoading}
          variant="outlined"
        >
          <InputLabel id="components-label">Components</InputLabel>
          {componentsLoading ? (
            <Skeleton variant="rect" height={56} />
          ) : (
            <Select
              multiple
              value={filters.components || []}
              onChange={handleComponentChange}
              labelId="components-label"
              label="Component"
              renderValue={selected => {
                const selectedArray = selected as string[];
                if (selectedArray.length === 0) return 'All';
                return selectedArray
                  .map(id => {
                    const comp = components.find(c => c.name === id);
                    return comp?.displayName || comp?.name || id;
                  })
                  .join(', ');
              }}
            >
              {components.map(component => {
                return (
                  <MenuItem key={component.name} value={component.name}>
                    <Checkbox
                      checked={
                        (filters.components || []).indexOf(component.name) > -1
                      }
                    />
                    {component.displayName || component.name}
                  </MenuItem>
                );
              })}
            </Select>
          )}
        </FormControl>
      </Grid>

      <Grid item xs={12} md={3}>
        <FormControl
          fullWidth
          disabled={disabled || environmentsLoading}
          variant="outlined"
        >
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
        <FormControl fullWidth disabled={disabled} variant="outlined">
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
