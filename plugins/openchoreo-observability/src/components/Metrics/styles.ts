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

export const useMetricGraphStyles = makeStyles((theme: Theme) => ({
  chartContainer: {
    width: '100%',
  },
  lineChart: {
    width: '100%',
    maxWidth: '100%',
    maxHeight: '70vh',
    aspectRatio: 1.618,
  },
  emptyChart: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    fontSize: '1.2rem',
    color: theme.palette.text.secondary,
  },
  emptyChartText: {
    alignItems: 'center',
    justifyContent: 'center',
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    textAlign: 'center',
    fontSize: '0.875rem',
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(1),
  },
}));

export const useObservabilityMetricsPageStyles = makeStyles((theme: Theme) => ({
  metricsGridContainer: {
    marginTop: theme.spacing(0),
  },
  errorContainer: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  metricsContentContainer: {
    padding: theme.spacing(0),
  },
}));
