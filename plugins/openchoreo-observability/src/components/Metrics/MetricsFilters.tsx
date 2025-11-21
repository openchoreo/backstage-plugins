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
    const selectedEnvironment = environments.find(
      env => env.uid === (event.target.value as string),
    );
    if (selectedEnvironment) {
      onFiltersChange({ environment: selectedEnvironment });
    }
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
          <InputLabel id="environment-label">Environment</InputLabel>
          <Select
            value={filters.environment?.uid || ''}
            onChange={handleEnvironmentChange}
            labelId="environment-label"
            label="Environment"
          >
            {environments.map((environment: Environment) => (
              <MenuItem key={environment.uid} value={environment.uid}>
                {environment.displayName || environment.name}
              </MenuItem>
            ))}
          </Select>
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
