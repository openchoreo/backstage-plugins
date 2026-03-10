import { FC, ChangeEvent, useState, useEffect } from 'react';
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
import { useDebounce } from 'react-use';
import type { AlertsFilters } from './types';
import { ALERTS_TIME_RANGE_OPTIONS, ALERT_SEVERITIES } from './types';
import type { Environment } from '../RuntimeLogs/types';

interface AlertsFilterProps {
  filters: AlertsFilters;
  onFiltersChange: (filters: Partial<AlertsFilters>) => void;
  environments: Environment[];
  environmentsLoading: boolean;
  disabled?: boolean;
}

export const AlertsFilter: FC<AlertsFilterProps> = ({
  filters,
  onFiltersChange,
  environments,
  environmentsLoading,
  disabled = false,
}) => {
  const [searchInput, setSearchInput] = useState(filters.searchQuery || '');

  useEffect(() => {
    setSearchInput(filters.searchQuery || '');
  }, [filters.searchQuery]);

  const DEFAULT_DEBOUNCE_MS = 1000;
  useDebounce(
    () => {
      onFiltersChange({ searchQuery: searchInput });
    },
    DEFAULT_DEBOUNCE_MS,
    [searchInput, onFiltersChange],
  );

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchInput(event.target.value);
  };

  const handleEnvironmentChange = (event: ChangeEvent<{ value: unknown }>) => {
    onFiltersChange({ environmentId: event.target.value as string });
  };

  const handleTimeRangeChange = (event: ChangeEvent<{ value: unknown }>) => {
    onFiltersChange({ timeRange: event.target.value as string });
  };

  const handleSeverityChange = (event: ChangeEvent<{ value: unknown }>) => {
    onFiltersChange({ severity: event.target.value as string[] });
  };

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          placeholder="Search alerts..."
          variant="outlined"
          value={searchInput}
          onChange={handleSearchChange}
          disabled={disabled}
        />
      </Grid>

      <Grid item xs={12} md={2}>
        <FormControl fullWidth disabled={disabled} variant="outlined">
          <InputLabel id="severity-label">Severity</InputLabel>
          <Select
            multiple
            value={filters.severity || []}
            onChange={handleSeverityChange}
            labelId="severity-label"
            label="Severity"
            renderValue={selected =>
              (selected as string[]).length === 0
                ? 'All'
                : (selected as string[]).join(', ')
            }
          >
            {ALERT_SEVERITIES.map(sev => (
              <MenuItem key={sev} value={sev}>
                <Checkbox
                  checked={(filters.severity || []).indexOf(sev) > -1}
                />
                {sev.charAt(0).toUpperCase() + sev.slice(1)}
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
              value={filters.environmentId}
              onChange={handleEnvironmentChange}
              labelId="environment-label"
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

      <Grid item xs={12} md={2}>
        <FormControl fullWidth disabled={disabled} variant="outlined">
          <InputLabel id="time-range-label">Time Range</InputLabel>
          <Select
            value={filters.timeRange}
            onChange={handleTimeRangeChange}
            labelId="time-range-label"
            label="Time Range"
          >
            {ALERTS_TIME_RANGE_OPTIONS.map(opt => (
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
