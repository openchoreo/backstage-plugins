import { FC, ChangeEvent } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  Grid,
  TextField,
} from '@material-ui/core';
import { type AlertsFilters, ALERT_SEVERITIES } from './types';
import {
  Environment,
  EnvironmentFilter,
  TimeRangeFilter,
} from '@openchoreo/backstage-plugin-react';
import { useDebouncedSearch } from '../../hooks/useDebouncedSearch';

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
  const [searchInput, handleSearchChange] = useDebouncedSearch(
    filters.searchQuery,
    value => onFiltersChange({ searchQuery: value }),
  );

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
        <EnvironmentFilter
          environments={environments}
          loading={environmentsLoading}
          value={environments.find(e => e.name === filters.environment) ?? null}
          onChange={env => onFiltersChange({ environment: env?.name ?? '' })}
          disabled={disabled}
          size="medium"
        />
      </Grid>

      <Grid item xs={12} md={2}>
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
