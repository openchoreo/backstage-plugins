import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
} from '@material-ui/core';
import { Filters, Environment } from '../../types';
import { TimeRangeFilter } from '@openchoreo/backstage-plugin-react';

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

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={3}>
        {/* TODO: Add Filters for Metrics */}
      </Grid>

      <Grid item xs={12} md={3}>
        {/* TODO: Add Filters for Metrics */}
      </Grid>

      <Grid item xs={12} md={3}>
        <FormControl fullWidth disabled={disabled} variant="outlined">
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
        <TimeRangeFilter
          value={filters.timeRange}
          customStartTime={filters.customStartTime}
          customEndTime={filters.customEndTime}
          onChange={onFiltersChange}
          disabled={disabled}
        />
      </Grid>
    </Grid>
  );
};
