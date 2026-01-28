import { makeStyles } from '@material-ui/core/styles';

export const useStyles = makeStyles(theme => ({
  card: {
    height: '100%',
  },
  metricRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
    padding: theme.spacing(1),
    marginLeft: theme.spacing(-1),
    marginRight: theme.spacing(-1),
    borderRadius: theme.spacing(0.5),
    transition: 'background-color 0.15s ease-in-out',
    '&:last-child': {
      marginBottom: 0,
    },
  },
  metricRowClickable: {
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  metricLabel: {
    color: theme.palette.text.secondary,
  },
  metricValue: {
    fontWeight: 700,
    color: theme.palette.text.primary,
  },
  skeleton: {
    marginBottom: theme.spacing(2),
    borderRadius: theme.spacing(0.5),
    '&:last-child': {
      marginBottom: 0,
    },
  },
  errorContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: theme.spacing(10),
    gridGap: theme.spacing(1),
  },
  heroMetric: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: theme.spacing(2, 0),
    marginBottom: theme.spacing(2),
    borderRadius: theme.spacing(1),
    backgroundColor: theme.palette.action.hover,
    transition: 'background-color 0.15s ease-in-out',
  },
  heroMetricClickable: {
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: theme.palette.action.selected,
    },
  },
  heroValue: {
    fontSize: '2rem',
    fontWeight: 700,
    color: theme.palette.text.primary,
    lineHeight: 1.2,
  },
  heroLabel: {
    fontSize: '0.8rem',
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(0.5),
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
    gap: theme.spacing(1.5),
    flex: 1,
  },
  metricCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(1.5),
    borderRadius: theme.spacing(1),
    backgroundColor: theme.palette.action.hover,
    border: `1px solid ${theme.palette.divider}`,
    transition: 'all 0.15s ease-in-out',
    textAlign: 'center',
    minHeight: theme.spacing(10),
  },
  metricCardClickable: {
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: theme.palette.action.selected,
      borderColor: theme.palette.primary.light,
      transform: 'translateY(-1px)',
      boxShadow: theme.shadows[2],
    },
  },
  metricCardIcon: {
    fontSize: '1.5rem',
    color: theme.palette.primary.main,
    marginBottom: theme.spacing(0.5),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricCardValue: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: theme.palette.text.primary,
    lineHeight: 1.2,
  },
  metricCardLabel: {
    fontSize: '0.7rem',
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(0.25),
    lineHeight: 1.2,
  },
}));
