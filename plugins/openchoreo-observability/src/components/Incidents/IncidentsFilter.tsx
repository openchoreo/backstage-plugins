import { FC, ChangeEvent } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  Grid,
  TextField,
} from '@material-ui/core';
import { Skeleton } from '@material-ui/lab';
import type { IncidentsFilters } from './types';
import { TIME_RANGE_OPTIONS } from '../../types';
import { INCIDENT_STATUSES } from './types';
import type { Environment } from '../../types';
import { useDebouncedSearch } from '../../hooks/useDebouncedSearch';
import type { Component } from '../../hooks/useGetComponentsByProject';

interface IncidentsFilterProps {
  filters: IncidentsFilters;
  onFiltersChange: (filters: Partial<IncidentsFilters>) => void;
  environments: Environment[];
  environmentsLoading: boolean;
  components?: Component[];
  componentsLoading?: boolean;
  disabled?: boolean;
}

export const IncidentsFilter: FC<IncidentsFilterProps> = ({
  filters,
  onFiltersChange,
  environments,
  environmentsLoading,
  components = [],
  componentsLoading = false,
  disabled = false,
}) => {
  const [searchInput, handleSearchChange] = useDebouncedSearch(
    filters.searchQuery,
    value => onFiltersChange({ searchQuery: value }),
  );

  const handleEnvironmentChange = (event: ChangeEvent<{ value: unknown }>) => {
    onFiltersChange({
      environment: event.target.value as string,
      searchQuery: '',
    });
  };

  const handleTimeRangeChange = (event: ChangeEvent<{ value: unknown }>) => {
    onFiltersChange({
      timeRange: event.target.value as string,
      searchQuery: '',
    });
  };

  const handleComponentChange = (event: ChangeEvent<{ value: unknown }>) => {
    onFiltersChange({
      components: event.target.value as string[],
      searchQuery: '',
    });
  };

  const handleStatusChange = (event: ChangeEvent<{ value: unknown }>) => {
    onFiltersChange({
      status: event.target.value as string[],
      searchQuery: '',
    });
  };

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={4}>
        <TextField
          fullWidth
          placeholder="Search incidents..."
          variant="outlined"
          value={searchInput}
          onChange={handleSearchChange}
          disabled={disabled}
        />
      </Grid>

      {components.length > 0 && (
        <Grid item xs={12} md={2}>
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
                label="Components"
                renderValue={selected => {
                  const arr = selected as string[];
                  return arr.length === 0 ? 'All' : arr.join(', ');
                }}
              >
                {components.map(comp => (
                  <MenuItem key={comp.name} value={comp.name}>
                    <Checkbox
                      checked={
                        (filters.components || []).indexOf(comp.name) > -1
                      }
                    />
                    {comp.displayName || comp.name}
                  </MenuItem>
                ))}
              </Select>
            )}
          </FormControl>
        </Grid>
      )}

      <Grid item xs={12} md={2}>
        <FormControl fullWidth disabled={disabled} variant="outlined">
          <InputLabel id="status-label">Status</InputLabel>
          <Select
            multiple
            value={filters.status || []}
            onChange={handleStatusChange}
            labelId="status-label"
            label="Status"
            renderValue={selected => {
              const arr = selected as string[];
              return arr.length === 0 ? 'All' : arr.join(', ');
            }}
          >
            {INCIDENT_STATUSES.map(s => (
              <MenuItem key={s} value={s}>
                <Checkbox checked={(filters.status || []).indexOf(s) > -1} />
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} md={2}>
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
              value={filters.environment}
              onChange={handleEnvironmentChange}
              labelId="environment-label"
              label="Environment"
            >
              {environments.map(env => (
                <MenuItem key={env.name} value={env.name}>
                  {env.displayName || env.name}
                </MenuItem>
              ))}
            </Select>
          )}
        </FormControl>
      </Grid>

      <Grid item xs={12} md={2}>
        <FormControl fullWidth disabled={disabled} variant="outlined">
          <InputLabel id="time-range-label">Time Range</InputLabel>
          <Select
            value={filters.timeRange}
            onChange={handleTimeRangeChange}
            labelId="time-range-label"
            label="Time Range"
          >
            {TIME_RANGE_OPTIONS.map(opt => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
    </Grid>
  );
};
