import { FC, ChangeEvent } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Box,
  Chip,
  IconButton,
  Tooltip,
  Typography,
} from '@material-ui/core';
import Refresh from '@material-ui/icons/Refresh';
import { Skeleton, Autocomplete } from '@material-ui/lab';
import { TextField } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import {
  RuntimeLogsFilters,
  Environment,
  LOG_LEVELS,
  TIME_RANGE_OPTIONS,
} from './types';

const useStyles = makeStyles(theme => ({
  filterContainer: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    backgroundColor: theme.palette.background.default,
  },
  filterSection: {
    // marginBottom: theme.spacing(2),
  },
  refreshButtonContainer: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  refreshButton: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  levelSelectorChip: {
    marginTop: 2,
    marginBottom: -2,
  },
  errorLevel: {
    color: theme.palette.error.main,
    borderColor: theme.palette.error.main,
  },
  warnLevel: {
    color: theme.palette.warning.main,
    borderColor: theme.palette.warning.main,
  },
  infoLevel: {
    color: theme.palette.info.main,
    borderColor: theme.palette.info.main,
  },
  debugLevel: {
    color: theme.palette.text.secondary,
    borderColor: theme.palette.text.secondary,
  },
  undefinedLevel: {
    color: theme.palette.text.disabled,
    borderColor: theme.palette.text.disabled,
  },
}));

interface LogsFilterProps {
  filters: RuntimeLogsFilters;
  onFiltersChange: (filters: Partial<RuntimeLogsFilters>) => void;
  environments: Environment[];
  environmentsLoading: boolean;
  disabled?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const LogsFilter: FC<LogsFilterProps> = ({
  filters,
  onFiltersChange,
  environments,
  environmentsLoading,
  disabled = false,
  onRefresh,
  isRefreshing = false,
}) => {
  const classes = useStyles();

  const handleLogLevelChange = (_event: any, newValue: string[]) => {
    // If no options are selected, consider it as all selected
    const selectedLevels = newValue.length === 0 ? [] : newValue;
    onFiltersChange({ logLevel: selectedLevels });
  };

  const handleEnvironmentChange = (event: ChangeEvent<{ value: unknown }>) => {
    onFiltersChange({ environmentId: event.target.value as string });
  };

  const handleTimeRangeChange = (event: ChangeEvent<{ value: unknown }>) => {
    onFiltersChange({ timeRange: event.target.value as string });
  };

  const getLogLevelClassName = (level: string) => {
    switch (level) {
      case 'ERROR':
        return classes.errorLevel;
      case 'WARN':
        return classes.warnLevel;
      case 'INFO':
        return classes.infoLevel;
      case 'DEBUG':
        return classes.debugLevel;
      case 'UNDEFINED':
        return classes.undefinedLevel;
      default:
        return '';
    }
  };
  const getLogLevelDisplayName = (level: string) => {
    switch (level) {
      case 'ERROR':
        return 'Error';
      case 'WARN':
        return 'Warn';
      case 'INFO':
        return 'Info';
      case 'DEBUG':
        return 'Debug';
      case 'UNDEFINED':
        return classes.undefinedLevel;
      default:
        return '';
    }
  };
  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={4}>
        <Box className={classes.filterSection}>
          <Autocomplete
            multiple
            options={LOG_LEVELS}
            value={
              filters.logLevel.length === LOG_LEVELS.length
                ? []
                : filters.logLevel
            }
            onChange={handleLogLevelChange}
            disabled={disabled}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  {...getTagProps({ index })}
                  key={option}
                  label={
                    <Typography
                      component="span"
                      variant="body2"
                      className={getLogLevelClassName(option)}
                    >
                      {getLogLevelDisplayName(option)}
                    </Typography>
                  }
                  size="small"
                  variant="outlined"
                  className={classes.levelSelectorChip}
                />
              ))
            }
            renderOption={option => (
              <Typography component="span" variant="body2">
                {getLogLevelDisplayName(option)}
              </Typography>
            )}
            renderInput={params => (
              <TextField
                {...params}
                variant="outlined"
                size="small"
                label="Log Levels"
                placeholder={
                  filters.logLevel.length === LOG_LEVELS.length
                    ? 'All levels selected'
                    : 'Select log levels'
                }
              />
            )}
            noOptionsText="No log levels available"
          />
        </Box>
      </Grid>

      <Grid item xs={12} md={4}>
        <Box className={classes.filterSection}>
          <FormControl
            fullWidth
            disabled={disabled || environmentsLoading}
            variant="outlined"
            size="small"
          >
            <InputLabel>Environment</InputLabel>
            {environmentsLoading ? (
              <Skeleton variant="rect" height={56} />
            ) : (
              <Select
                label="Environment"
                value={filters.environmentId}
                onChange={handleEnvironmentChange}
              >
                {environments.map(env => (
                  <MenuItem key={env.id} value={env.id}>
                    {env.name}
                  </MenuItem>
                ))}
              </Select>
            )}
          </FormControl>
        </Box>
      </Grid>

      <Grid item xs={12} md={3}>
        <Box className={classes.filterSection}>
          <FormControl
            fullWidth
            disabled={disabled}
            variant="outlined"
            size="small"
          >
            <InputLabel>Time Range</InputLabel>
            <Select
              value={filters.timeRange}
              onChange={handleTimeRangeChange}
              label="Time Range"
            >
              {TIME_RANGE_OPTIONS.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Grid>
      {onRefresh && (
        <Grid item xs={12} md={1} alignItems="flex-end">
          <Box className={classes.refreshButtonContainer}>
            <Tooltip title="Refresh">
              <IconButton
                onClick={onRefresh}
                disabled={isRefreshing || !filters.environmentId}
                className={classes.refreshButton}
              >
                <Refresh />
              </IconButton>
            </Tooltip>
          </Box>
        </Grid>
      )}
    </Grid>
  );
};
