import { ChangeEvent } from 'react';
import {
  Checkbox,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
} from '@material-ui/core';
import { Skeleton } from '@openchoreo/backstage-design-system';
import { Filters } from '../../types';
import { Component } from '../../hooks/useGetComponentsByProject';
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
  /** Project-level only. Omitted on the component page, where there is nothing
   *  to pick between and the selector is hidden. */
  components?: Component[];
  componentsLoading?: boolean;
  disabled?: boolean;
}

export const MetricsFilters = ({
  filters,
  onFiltersChange,
  environments,
  environmentsLoading = false,
  components = [],
  componentsLoading = false,
  disabled = false,
}: MetricsFiltersProps) => {
  const handleComponentChange = (event: ChangeEvent<{ value: unknown }>) => {
    onFiltersChange({ components: event.target.value as string[] });
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={3}>
        {components.length > 0 && (
          <FormControl
            fullWidth
            disabled={disabled || componentsLoading}
            variant="outlined"
          >
            <InputLabel id="metrics-components-label">Components</InputLabel>
            {componentsLoading ? (
              <Skeleton variant="rect" height={56} />
            ) : (
              <Select
                multiple
                value={filters.components || []}
                onChange={handleComponentChange}
                labelId="metrics-components-label"
                label="Components"
                renderValue={selected => {
                  const selectedArray = selected as string[];
                  if (selectedArray.length === 0) return 'All';
                  return selectedArray.join(', ');
                }}
              >
                {components.map(component => (
                  <MenuItem key={component.name} value={component.name}>
                    <Checkbox
                      checked={
                        (filters.components || []).indexOf(component.name) > -1
                      }
                    />
                    {component.displayName || component.name}
                  </MenuItem>
                ))}
              </Select>
            )}
          </FormControl>
        )}
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
