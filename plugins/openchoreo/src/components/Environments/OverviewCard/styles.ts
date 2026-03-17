import { makeStyles } from '@material-ui/core/styles';

export const useOverviewCardStyles = makeStyles(theme => ({
  card: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '12px !important',
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
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  environmentChips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    alignItems: 'center',
  },
  envChip: {
    height: '24px',
    fontWeight: 500,
    textTransform: 'capitalize',
  },
  statusIconReady: {
    color: theme.palette.success.main,
  },
  statusIconWarning: {
    color: theme.palette.warning.main,
  },
  statusIconError: {
    color: theme.palette.error.main,
  },
  statusIconDefault: {
    color: theme.palette.text.secondary,
  },
  actions: {
    marginTop: 'auto',
    paddingTop: theme.spacing(2),
    borderTop: `1px solid ${theme.palette.divider}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
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
