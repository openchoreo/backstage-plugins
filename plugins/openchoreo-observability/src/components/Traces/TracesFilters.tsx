import { FC, ChangeEvent } from 'react';
import { Skeleton } from '@openchoreo/backstage-design-system';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  TextField,
  Checkbox,
} from '@material-ui/core';
import { Filters } from '../../types';
import {
  Environment,
  EnvironmentFilter,
  TimeRangeFilter,
} from '@openchoreo/backstage-plugin-react';
import { Component } from '../../hooks/useGetComponentsByProject';
import { useDebouncedSearch } from '../../hooks/useDebouncedSearch';

interface TracesFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Partial<Filters>) => void;
  environments: Environment[];
  environmentsLoading: boolean;
  components: Component[];
  componentsLoading: boolean;
  disabled?: boolean;
}

export const TracesFilters: FC<TracesFiltersProps> = ({
  filters,
  onFiltersChange,
  environments,
  environmentsLoading,
  components,
  componentsLoading,
  disabled = false,
}) => {
  const [searchInput, handleSearchChange] = useDebouncedSearch(
    filters.searchQuery,
    value => onFiltersChange({ searchQuery: value }),
    500,
  );

  const handleComponentChange = (event: ChangeEvent<{ value: unknown }>) => {
    const value = event.target.value as string[];
    onFiltersChange({ components: value });
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={3}>
        <TextField
          fullWidth
          label="Search Trace ID"
          variant="outlined"
          value={searchInput}
          onChange={handleSearchChange}
          placeholder="Enter Trace ID to search"
          disabled={disabled}
        />
      </Grid>

      <Grid item xs={12} md={3}>
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
              label="Component"
              renderValue={selected => {
                const selectedArray = selected as string[];
                if (selectedArray.length === 0) return 'All';
                return selectedArray
                  .map(id => {
                    const comp = components.find(c => c.name === id);
                    return comp?.displayName || comp?.name || id;
                  })
                  .join(', ');
              }}
            >
              {components.map(component => {
                return (
                  <MenuItem key={component.name} value={component.name}>
                    <Checkbox
                      checked={
                        (filters.components || []).indexOf(component.name) > -1
                      }
                    />
                    {component.displayName || component.name}
                  </MenuItem>
                );
              })}
            </Select>
          )}
        </FormControl>
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
