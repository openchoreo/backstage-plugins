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
    position: 'relative',
  },
  lineChart: {
    width: '100%',
    maxWidth: '100%',
    maxHeight: '70vh',
    aspectRatio: 1.618,
  },
  emptyOverlay: {
    alignItems: 'center',
    color: theme.palette.text.secondary,
    display: 'flex',
    fontSize: '1rem',
    justifyContent: 'center',
    left: 0,
    pointerEvents: 'none',
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
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
