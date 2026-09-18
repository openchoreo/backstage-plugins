import { ChangeEvent } from 'react';
import {
  Checkbox,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
} from '@material-ui/core';
import ToggleButton from '@material-ui/lab/ToggleButton';
import ToggleButtonGroup from '@material-ui/lab/ToggleButtonGroup';
import { Skeleton } from '@openchoreo/backstage-design-system';
import { Filters, MetricsViewMode } from '../../types';
import { Component } from '../../hooks/useGetComponentsByProject';
import {
  EnvironmentFilter,
  TimeRangeFilter,
  Environment,
} from '@openchoreo/backstage-plugin-react';
import { useMetricsViewToggleStyles } from './styles';

interface MetricsFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Partial<Filters>) => void;
  environments: Environment[];
  environmentsLoading?: boolean;
  /** Project-level only. Omitted on the component page, where there is nothing
   *  to pick between and the selector is hidden. */
  components?: Component[];
  componentsLoading?: boolean;
  /** Project-level only. The two views are opposing, not on and off, so they
   *  get a segmented control rather than a switch. The component page passes
   *  no handler and the control does not render there. */
  viewMode?: MetricsViewMode;
  onViewModeChange?: (view: MetricsViewMode) => void;
  disabled?: boolean;
}

export const MetricsFilters = ({
  filters,
  onFiltersChange,
  environments,
  environmentsLoading = false,
  components = [],
  componentsLoading = false,
  viewMode = 'total',
  onViewModeChange,
  disabled = false,
}: MetricsFiltersProps) => {
  const classes = useMetricsViewToggleStyles();

  const handleComponentChange = (event: ChangeEvent<{ value: unknown }>) => {
    onFiltersChange({ components: event.target.value as string[] });
  };

  // The selector belongs to the breakdown view alone. Showing it greyed out in
  // the total view would advertise a control that does nothing there.
  const showComponentSelector =
    components.length > 0 && (!onViewModeChange || viewMode === 'breakdown');

  return (
    <Grid container spacing={3}>
      {onViewModeChange && (
        <Grid item xs={12} md={3}>
          <ToggleButtonGroup
            exclusive
            size="medium"
            value={viewMode}
            onChange={(_event, next) =>
              next && onViewModeChange(next as MetricsViewMode)
            }
            className={classes.toggleGroup}
            aria-label="Metrics view"
          >
            <ToggleButton
              value="total"
              className={classes.toggleButton}
              disabled={disabled}
            >
              Project
            </ToggleButton>
            <ToggleButton
              value="breakdown"
              className={classes.toggleButton}
              disabled={disabled}
            >
              By component
            </ToggleButton>
          </ToggleButtonGroup>
        </Grid>
      )}

      <Grid item xs={12} md={3}>
        {showComponentSelector && (
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
                  // Same label as the checkbox row, so the closed select and
                  // the open list name a component the same way.
                  return selectedArray
                    .map(name => {
                      const match = components.find(c => c.name === name);
                      return match?.displayName || name;
                    })
                    .join(', ');
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

      {/* TODO: Add Filters for Metrics */}

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
