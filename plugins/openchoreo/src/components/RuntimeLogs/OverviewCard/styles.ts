import { makeStyles } from '@material-ui/core/styles';

export const useOverviewCardStyles = makeStyles(theme => ({
  card: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
  },
  cardTitle: {
    fontWeight: 600,
    fontSize: theme.typography.h6.fontSize,
    color: theme.palette.text.primary,
  },
  viewLink: {
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.primary.main,
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  timeRangeLabel: {
    fontSize: theme.typography.caption.fontSize,
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(0.5),
  },
  countsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(3),
    flexWrap: 'wrap',
  },
  countItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
  },
  countValue: {
    fontWeight: 600,
    fontSize: theme.typography.h6.fontSize,
  },
  countLabel: {
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.text.secondary,
  },
  errorCount: {
    color: theme.palette.error.main,
  },
  warningCount: {
    color: theme.palette.warning.dark,
  },
  healthyState: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    color: theme.palette.success.main,
  },
  healthyIcon: {
    color: theme.palette.success.main,
  },
  lastActivityRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    color: theme.palette.text.secondary,
    fontSize: theme.typography.caption.fontSize,
  },
  metaIcon: {
    fontSize: '1rem',
  },
  actions: {
    marginTop: 'auto',
    paddingTop: theme.spacing(2),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  disabledState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: theme.spacing(2),
    color: theme.palette.text.secondary,
    flex: 1,
  },
  disabledIcon: {
    fontSize: '2.5rem',
    color: theme.palette.action.disabled,
    marginBottom: theme.spacing(1),
  },
}));
