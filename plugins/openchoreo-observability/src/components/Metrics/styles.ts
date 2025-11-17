import { makeStyles, Theme } from '@material-ui/core/styles';

export const useMetricsActionsStyles = makeStyles((theme: Theme) => ({
  statsContainer: {
    marginTop: theme.spacing(2),
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionsContainer: {
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'center',
  },
}));

export const useMetricGraphStyles = makeStyles(() => ({
  chartContainer: {
    width: '100%',
  },
  lineChart: {
    width: '100%',
    maxWidth: '100%',
    maxHeight: '70vh',
    aspectRatio: 1.618,
  },
}));

export const useObservabilityMetricsPageStyles = makeStyles((theme: Theme) => ({
  metricsGridContainer: {
    marginTop: theme.spacing(0),
  },
}));
