import { FC, ChangeEvent } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  Grid,
} from '@material-ui/core';
import {
  Environment,
  EnvironmentFilter,
  TimeRangeFilter,
} from '@openchoreo/backstage-plugin-react';
import {
  RuntimeEventsFilters,
  SELECTED_FIELDS,
  EventEntryField,
} from './types';

interface EventsFilterProps {
  filters: RuntimeEventsFilters;
  onFiltersChange: (filters: Partial<RuntimeEventsFilters>) => void;
  environments: Environment[];
  environmentsLoading: boolean;
  disabled?: boolean;
}

export const EventsFilter: FC<EventsFilterProps> = ({
  filters,
  onFiltersChange,
  environments,
  environmentsLoading,
  disabled = false,
}) => {
  const handleSelectedFieldsChange = (
    event: ChangeEvent<{ value: unknown }>,
  ) => {
    let selectedFields = event.target.value as EventEntryField[];
    // Ensure Message field is always included
    if (!selectedFields.includes(EventEntryField.Message)) {
      selectedFields = [...selectedFields, EventEntryField.Message];
    }
    // Normalize to the canonical column order — reordering columns is not supported
    onFiltersChange({
      selectedFields: SELECTED_FIELDS.filter(field =>
        selectedFields.includes(field),
      ),
    });
  };

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={3}>
        <FormControl fullWidth disabled={disabled} variant="outlined">
          <InputLabel id="selected-fields-label">Selected Fields</InputLabel>
          <Select
            multiple
            value={filters.selectedFields}
            onChange={handleSelectedFieldsChange}
            labelId="selected-fields-label"
            label="Selected Fields"
            renderValue={selected => (selected as EventEntryField[]).join(', ')}
          >
            {SELECTED_FIELDS.map((field: EventEntryField) => (
              <MenuItem
                key={field}
                value={field}
                disabled={field === EventEntryField.Message}
              >
                <Checkbox
                  checked={filters.selectedFields.includes(field)}
                  disabled={field === EventEntryField.Message}
                />
                {field}
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
