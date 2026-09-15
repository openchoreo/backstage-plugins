import { FC } from 'react';
import { Button, Grid, Tooltip, makeStyles } from '@material-ui/core';
import Refresh from '@material-ui/icons/Refresh';
import { type Environment } from '@openchoreo/backstage-plugin-react';
import { EnvironmentMultiSelect } from './EnvironmentMultiSelect';

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
  /** Refetch the cost data. */
  onRefresh?: () => void;
  /** Disables the refresh button while a fetch is in flight. */
  refreshing?: boolean;
  disabled?: boolean;
}

const useStyles = makeStyles(() => ({
  spacer: { flexGrow: 1 },
  control: { minWidth: 220 },
}));

export const CostInsightsFilters: FC<CostInsightsFiltersProps> = ({
  environments,
  environmentsLoading = false,
  selectedEnvironments,
  onEnvironmentsChange,
  onRefresh,
  refreshing = false,
  disabled = false,
}) => {
  const classes = useStyles();

  return (
    <Grid container spacing={2} alignItems="center" wrap="nowrap">
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

      {onRefresh && (
        <Grid item>
          <Tooltip title="Refresh">
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={onRefresh}
              disabled={disabled || refreshing}
            >
              Refresh
            </Button>
          </Tooltip>
        </Grid>
      )}
    </Grid>
  );
};
