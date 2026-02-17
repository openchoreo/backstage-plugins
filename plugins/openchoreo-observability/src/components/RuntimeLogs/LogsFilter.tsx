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
import {
  RuntimeLogsFilters,
  Environment,
  LOG_LEVELS,
  TIME_RANGE_OPTIONS,
  SELECTED_FIELDS,
  LogEntryField,
} from './types';

interface LogsFilterProps {
  filters: RuntimeLogsFilters;
  onFiltersChange: (filters: Partial<RuntimeLogsFilters>) => void;
  environments: Environment[];
  environmentsLoading: boolean;
  disabled?: boolean;
}

export const LogsFilter: FC<LogsFilterProps> = ({
  filters,
  onFiltersChange,
  environments,
  environmentsLoading,
  disabled = false,
}) => {
  const [searchInput, setSearchInput] = useState(filters.searchQuery || '');

  // Sync searchInput with filters.searchQuery when it changes externally
  useEffect(() => {
    setSearchInput(filters.searchQuery || '');
  }, [filters.searchQuery]);

  // Debounce the search query
  const DEFAULT_DEBOUNCE_TIME_MS = 1000;
  useDebounce(
    () => {
      onFiltersChange({ searchQuery: searchInput });
    },
    DEFAULT_DEBOUNCE_TIME_MS,
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

  const handleLogLevelSelectChange = (
    event: ChangeEvent<{ value: unknown }>,
  ) => {
    onFiltersChange({ logLevel: event.target.value as string[] });
  };

  const handleSelectedFieldsChange = (
    event: ChangeEvent<{ value: unknown }>,
  ) => {
    let selectedFields = event.target.value as LogEntryField[];
    // Ensure Log field is always included
    if (!selectedFields.includes(LogEntryField.Log)) {
      selectedFields = [...selectedFields, LogEntryField.Log];
    }
    // sort by the order of the SELECTED_FIELDS array
    // Customizing the order of the selected fields is not supported yet
    onFiltersChange({
      selectedFields: SELECTED_FIELDS.filter(field =>
        selectedFields.includes(field),
      ),
    });
  };

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={4}>
        <TextField
          fullWidth
          placeholder="Search Logs..."
          variant="outlined"
          value={searchInput}
          onChange={handleSearchChange}
          disabled={disabled}
        />
      </Grid>

      <Grid item xs={12} md={2}>
        <FormControl fullWidth disabled={disabled} variant="outlined">
          <InputLabel id="selected-fields-label">Selected Fields</InputLabel>
          <Select
            multiple
            value={filters.selectedFields}
            onChange={handleSelectedFieldsChange}
            labelId="selected-fields-label"
            label="Selected Fields"
            renderValue={selected => (selected as LogEntryField[]).join(', ')}
          >
            {SELECTED_FIELDS.map((field: LogEntryField) => (
              <MenuItem
                key={field}
                value={field}
                disabled={field === LogEntryField.Log}
              >
                <Checkbox
                  checked={filters.selectedFields.includes(field)}
                  disabled={field === LogEntryField.Log}
                />
                {field}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} md={2}>
        <FormControl fullWidth disabled={disabled} variant="outlined">
          <InputLabel id="log-levels-label">Log Levels</InputLabel>
          <Select
            multiple
            value={filters.logLevel}
            onChange={handleLogLevelSelectChange}
            labelId="log-levels-label"
            label="Log Levels"
            renderValue={selected => (selected as string[]).join(', ')}
          >
            {LOG_LEVELS.map(level => (
              <MenuItem key={level} value={level}>
                <Checkbox checked={filters.logLevel.includes(level)} />
                {level}
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
