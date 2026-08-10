import { FC } from 'react';
import { Grid, makeStyles } from '@material-ui/core';
import ToggleButton from '@material-ui/lab/ToggleButton';
import ToggleButtonGroup from '@material-ui/lab/ToggleButtonGroup';
import {
  TimeRangeFilter,
  type Environment,
} from '@openchoreo/backstage-plugin-react';
import { EnvironmentMultiSelect } from './EnvironmentMultiSelect';
import type { CostViewMode } from './types';

export const GRANULARITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '1h', label: '1 hour' },
  { value: '6h', label: '6 hours' },
  { value: '12h', label: '12 hours' },
  { value: '1d', label: '1 day' },
  { value: '7d', label: '1 week' },
];

export const DEFAULT_GRANULARITY = '1d';

export interface CostInsightsFiltersProps {
  environments: Environment[];
  environmentsLoading?: boolean;
  selectedEnvironments: string[];
  onEnvironmentsChange: (names: string[]) => void;
  view: CostViewMode;
  onViewChange: (view: CostViewMode) => void;
  timeRange: string;
  customStartTime?: string;
  customEndTime?: string;
  onTimeRangeChange: (next: {
    timeRange: string;
    customStartTime?: string;
    customEndTime?: string;
  }) => void;
  disabled?: boolean;
}

const useStyles = makeStyles(theme => ({
  toggleGroup: { height: '100%' },
  toggleButton: { textTransform: 'none', padding: theme.spacing(0, 2) },
  spacer: { flexGrow: 1 },
  control: { minWidth: 220 },
}));

export const CostInsightsFilters: FC<CostInsightsFiltersProps> = ({
  environments,
  environmentsLoading = false,
  selectedEnvironments,
  onEnvironmentsChange,
  view,
  onViewChange,
  timeRange,
  customStartTime,
  customEndTime,
  onTimeRangeChange,
  disabled = false,
}) => {
  const classes = useStyles();

  return (
    <Grid container spacing={2} alignItems="center" wrap="nowrap">
      <Grid item>
        <ToggleButtonGroup
          exclusive
          size="medium"
          value={view}
          onChange={(_e, next) => next && onViewChange(next as CostViewMode)}
          className={classes.toggleGroup}
          aria-label="View mode"
        >
          <ToggleButton
            value="table"
            className={classes.toggleButton}
            disabled={disabled}
          >
            Table
          </ToggleButton>
          <ToggleButton
            value="graph"
            className={classes.toggleButton}
            disabled={disabled}
          >
            Graphs
          </ToggleButton>
        </ToggleButtonGroup>
      </Grid>

      <Grid item className={classes.spacer} />

      <Grid item className={classes.control}>
        <EnvironmentMultiSelect
          environments={environments}
          loading={environmentsLoading}
          value={selectedEnvironments}
          onChange={onEnvironmentsChange}
          disabled={disabled}
        />
      </Grid>

      <Grid item className={classes.control}>
        <TimeRangeFilter
          value={timeRange}
          customStartTime={customStartTime}
          customEndTime={customEndTime}
          onChange={onTimeRangeChange}
          disabled={disabled}
        />
      </Grid>
    </Grid>
  );
};
