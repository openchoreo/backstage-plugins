import { FC } from 'react';
import {
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  makeStyles,
} from '@material-ui/core';
import type { CostInsightsData } from './types';
import { ForecastDivergenceChart } from './ForecastDivergenceChart';
import { CostEfficiencyScatter } from './CostEfficiencyScatter';
import { CostLineChart } from './CostLineChart';
import { CostInsightsGraph } from './CostInsightsGraph';
import { GRANULARITY_OPTIONS } from './CostInsightsFilters';

const useStyles = makeStyles(theme => ({
  timeSeriesGroup: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(2),
  },
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  granularityControl: { minWidth: 220 },
}));

export interface CostInsightsGraphsProps {
  data: CostInsightsData;
  granularity: string;
  onGranularityChange: (granularity: string) => void;
}

export const CostInsightsGraphs: FC<CostInsightsGraphsProps> = ({
  data,
  granularity,
  onGranularityChange,
}) => {
  const classes = useStyles();
  const { summary } = data;
  const overlay =
    data.level === 'component' &&
    summary.totalSaving > 0 &&
    summary.totalCost > 0
      ? { savingFraction: summary.totalSaving / summary.totalCost }
      : undefined;

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <ForecastDivergenceChart forecast={data.forecast} />
      </Grid>
      <Grid item xs={12} md={6}>
        <CostEfficiencyScatter rows={data.rows} />
      </Grid>
      <Grid item xs={12}>
        {/* Grouped so it's clear the granularity applies only to these two. */}
        <div className={classes.timeSeriesGroup}>
          <div className={classes.groupHeader}>
            <FormControl
              variant="outlined"
              className={classes.granularityControl}
            >
              <InputLabel id="cost-granularity-label">
                Time Granularity
              </InputLabel>
              <Select
                labelId="cost-granularity-label"
                label="Time Granularity"
                value={granularity}
                onChange={e => onGranularityChange(e.target.value as string)}
              >
                {GRANULARITY_OPTIONS.map(o => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <CostLineChart
                series={data.series}
                seriesKeys={data.seriesKeys}
              />
            </Grid>
            <Grid item xs={12}>
              <CostInsightsGraph
                series={data.series}
                seriesKeys={data.seriesKeys}
                title="Cost over time"
                recommendationOverlay={overlay}
              />
            </Grid>
          </Grid>
        </div>
      </Grid>
    </Grid>
  );
};
