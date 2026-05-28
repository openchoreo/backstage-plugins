import { ChangeEvent } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  TextField,
} from '@material-ui/core';
import { useDebouncedSearch } from '../../hooks/useDebouncedSearch';
import { Filters, RCA_STATUS_OPTIONS, RCAStatus } from '../../types';
import {
  Environment,
  EnvironmentFilter,
  TimeRangeFilter,
} from '@openchoreo/backstage-plugin-react';

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
  const [searchInput, handleSearchChange] = useDebouncedSearch(
    filters.searchQuery,
    value => onFiltersChange({ searchQuery: value }),
  );

  const handleTimeRangeChange = (next: {
    timeRange: string;
    customStartTime?: string;
    customEndTime?: string;
  }) => {
    onFiltersChange({ ...next, searchQuery: '' });
  };

  const handleStatusChange = (event: ChangeEvent<{ value: unknown }>) => {
    const value = event.target.value as string;
    onFiltersChange({
      rcaStatus: value ? (value as RCAStatus) : undefined,
      searchQuery: '',
    });
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={3}>
        <TextField
          fullWidth
          placeholder="Search RCA reports..."
          variant="outlined"
          value={searchInput}
          onChange={handleSearchChange}
          disabled={disabled}
        />
      </Grid>

      <Grid item xs={12} md={3}>
        <EnvironmentFilter
          environments={environments}
          loading={environmentsLoading}
          value={filters.environment ?? null}
          onChange={env =>
            env &&
            onFiltersChange({
              environment: env as Environment,
              searchQuery: '',
            })
          }
          disabled={disabled}
          size="medium"
        />
      </Grid>

      <Grid item xs={12} md={3}>
        <FormControl fullWidth disabled={disabled} variant="outlined">
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

      <Grid item xs={12} md={3}>
        <TimeRangeFilter
          value={filters.timeRange}
          customStartTime={filters.customStartTime}
          customEndTime={filters.customEndTime}
          onChange={handleTimeRangeChange}
          disabled={disabled}
        />
      </Grid>
    </Grid>
  );
};
