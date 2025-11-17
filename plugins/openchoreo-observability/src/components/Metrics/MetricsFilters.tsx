import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
} from '@material-ui/core';
import {
  TIME_RANGE_OPTIONS,
  TimeRangeOption,
  Filters,
  Environment,
} from '../../types';

interface MetricsFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Partial<Filters>) => void;
  environments: Environment[];
  disabled?: boolean;
}

export const MetricsFilters = ({
  filters,
  onFiltersChange,
  environments,
  disabled = false,
}: MetricsFiltersProps) => {
  const handleEnvironmentChange = (
    event: React.ChangeEvent<{ value: unknown }>,
  ) => {
    onFiltersChange({ environmentId: event.target.value as string });
  };

  const handleTimeRangeChange = (
    event: React.ChangeEvent<{ value: unknown }>,
  ) => {
    onFiltersChange({ timeRange: event.target.value as string });
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={3}>
        {/* TODO: Add Filters for Metrics */}
      </Grid>

      <Grid item xs={12} md={3}>
        {/* TODO: Add Filters for Metrics */}
      </Grid>

      <Grid item xs={12} md={3}>
        <FormControl fullWidth disabled={disabled}>
          <InputLabel>Environment</InputLabel>
          <Select
            value={filters.environmentId}
            onChange={handleEnvironmentChange}
          >
            {environments.map((environment: Environment) => (
              <MenuItem key={environment.name} value={environment.name}>
                {environment.displayName}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} md={3}>
        <FormControl fullWidth disabled={disabled}>
          <InputLabel>Time Range</InputLabel>
          <Select value={filters.timeRange} onChange={handleTimeRangeChange}>
            {TIME_RANGE_OPTIONS.map((option: TimeRangeOption) => (
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
