import { Grid } from '@material-ui/core';
import { Filters } from '../../types';
import {
  EnvironmentFilter,
  TimeRangeFilter,
  Environment,
} from '@openchoreo/backstage-plugin-react';

interface MetricsFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Partial<Filters>) => void;
  environments: Environment[];
  environmentsLoading?: boolean;
  disabled?: boolean;
}

export const MetricsFilters = ({
  filters,
  onFiltersChange,
  environments,
  environmentsLoading = false,
  disabled = false,
}: MetricsFiltersProps) => {
  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={3}>
        {/* TODO: Add Filters for Metrics */}
      </Grid>

      <Grid item xs={12} md={3}>
        {/* TODO: Add Filters for Metrics */}
      </Grid>

      <Grid item xs={12} md={3}>
        <EnvironmentFilter
          environments={environments}
          loading={environmentsLoading}
          value={filters.environment ?? null}
          onChange={env =>
            env && onFiltersChange({ environment: env as Environment })
          }
          disabled={disabled}
          size="medium"
        />
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
