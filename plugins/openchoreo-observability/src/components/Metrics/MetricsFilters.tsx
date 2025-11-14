import { FC, ChangeEvent } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  Grid,
} from '@material-ui/core';
import { Skeleton } from '@material-ui/lab';
// import {
//   MetricsFilters,
//   Environment,
//   LOG_LEVELS,
//   TIME_RANGE_OPTIONS,
//   SELECTED_FIELDS,
//   LogEntryField,
// } from '../types';

// Temporary types
interface MetricsFilters {
  environmentId: string;
  timeRange: string;
}

interface Environment {
  id: string;
  name: string;
}

interface TimeRangeOption {
  value: string;
  label: string;
}

const TIME_RANGE_OPTIONS = [
  { value: '1h', label: '1 Hour' },
  { value: '6h', label: '6 Hours' },
  { value: '12h', label: '12 Hours' },
  { value: '24h', label: '24 Hours' },
];

interface MetricsFiltersProps {
  // filters?: MetricsFilters;
  // onFiltersChange: (filters: Partial<MetricsFilters>) => void;
  // environments: Environment[];
  // environmentsLoading: boolean;
  // disabled?: boolean;
}

export const MetricsFilters: FC<MetricsFiltersProps> = ({
  // filters,
  // onFiltersChange,
  // environments,
  // environmentsLoading,
  // disabled = false,
}) => {
  const handleEnvironmentChange = (event: ChangeEvent<{ value: unknown }>) => {
    // onFiltersChange({ environmentId: event.target.value as string });
    console.log(event.target.value);
  };

  const handleTimeRangeChange = (event: ChangeEvent<{ value: unknown }>) => {
    // onFiltersChange({ timeRange: event.target.value as string });
    console.log(event.target.value);
  };

  // const handleLogLevelSelectChange = (
  //   event: ChangeEvent<{ value: unknown }>,
  // ) => {
  //   onFiltersChange({ logLevel: event.target.value as string[] });
  // };

  // const handleSelectedFieldsChange = (
  //   event: ChangeEvent<{ value: unknown }>,
  // ) => {
  //   let selectedFields = event.target.value as LogEntryField[];
  //   // Ensure Log field is always included
  //   if (!selectedFields.includes(LogEntryField.Log)) {
  //     selectedFields = [...selectedFields, LogEntryField.Log];
  //   }
  //   // sort by the order of the SELECTED_FIELDS array
  //   // Customizing the order of the selected fields is not supported yet
  //   onFiltersChange({
  //     selectedFields: SELECTED_FIELDS.filter(field =>
  //       selectedFields.includes(field),
  //     ),
  //   });
  // };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={3}>
        {/* <FormControl fullWidth disabled={disabled}>
          <InputLabel>Log Levels</InputLabel>
          <Select
            multiple
            value={filters.logLevel}
            onChange={handleLogLevelSelectChange}
            renderValue={selected => (selected as string[]).join(', ')}
          >
            {LOG_LEVELS.map(level => (
              <MenuItem key={level} value={level}>
                <Checkbox checked={filters.logLevel.includes(level)} />
                {level}
              </MenuItem>
            ))}
          </Select>
        </FormControl> */}
      </Grid>

      <Grid item xs={12} md={3}>
        {/* <FormControl fullWidth disabled={disabled}>
          <InputLabel>Selected Fields</InputLabel>
          <Select
            multiple
            value={filters.selectedFields}
            onChange={handleSelectedFieldsChange}
            renderValue={selected => (selected as LogEntryField[]).join(', ')}
          >
            {SELECTED_FIELDS.map((field: LogEntryField) => (
              <MenuItem
                key={field}
                value={field}
                disabled={field === LogEntryField.Log}
              >
                <Checkbox
                  checked={filters.selectedFields.includes(field)}
                  disabled={field === LogEntryField.Log}
                />
                {field}
              </MenuItem>
            ))}
          </Select>
        </FormControl> */}
      </Grid>

      <Grid item xs={12} md={3}>
        {/* <FormControl fullWidth disabled={disabled || environmentsLoading}> */}
        <FormControl fullWidth>
          <InputLabel>Environment</InputLabel>
          <Select
            value={'1'}
            onChange={handleEnvironmentChange}
          >
            <MenuItem value="1">Development</MenuItem>
            <MenuItem value="2">Production</MenuItem>
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} md={3}>
        {/* <FormControl fullWidth disabled={disabled}> */}
        <FormControl fullWidth>
          <InputLabel>Time Range</InputLabel>
          <Select value={'1h'} onChange={handleTimeRangeChange}>
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
