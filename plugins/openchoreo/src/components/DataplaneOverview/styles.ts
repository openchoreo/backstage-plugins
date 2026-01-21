import { makeStyles } from '@material-ui/core/styles';

export const useDataplaneOverviewStyles = makeStyles(theme => ({
  card: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '12px !important',
    border: '1px solid rgb(243, 244, 246) !important',
    boxShadow:
      'rgba(0, 0, 0, 0.05) 0px 1px 3px 0px, rgba(0, 0, 0, 0.03) 0px 1px 2px 0px !important',
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
  },
  statusGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: theme.spacing(2),
  },
  statusItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5),
    borderRadius: theme.spacing(1),
    backgroundColor: theme.palette.background.default,
  },
  statusIcon: {
    fontSize: '1.5rem',
  },
  statusHealthy: {
    color: theme.palette.success.main,
  },
  statusWarning: {
    color: theme.palette.warning.main,
  },
  statusError: {
    color: theme.palette.error.main,
  },
  statusLabel: {
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.text.secondary,
  },
  statusValue: {
    fontSize: theme.typography.body2.fontSize,
    fontWeight: 500,
    color: theme.palette.text.primary,
  },
  environmentList: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
  },
  environmentItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(1.5),
    borderRadius: theme.spacing(1),
    marginBottom: theme.spacing(1),
    backgroundColor: theme.palette.background.default,
    '&:last-child': {
      marginBottom: 0,
    },
  },
  environmentInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
  },
  environmentName: {
    fontWeight: 500,
    color: theme.palette.text.primary,
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
      color: theme.palette.primary.main,
    },
  },
  environmentType: {
    fontSize: theme.typography.caption.fontSize,
    padding: theme.spacing(0.25, 1),
    borderRadius: theme.spacing(0.5),
  },
  productionBadge: {
    backgroundColor: theme.palette.error.light,
    color: theme.palette.error.dark,
  },
  nonProductionBadge: {
    backgroundColor: theme.palette.grey[200],
    color: theme.palette.grey[700],
  },
  environmentStats: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.text.secondary,
  },
  healthIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  },
  healthDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
  healthyDot: {
    backgroundColor: theme.palette.success.main,
  },
  warningDot: {
    backgroundColor: theme.palette.warning.main,
  },
  errorDot: {
    backgroundColor: theme.palette.error.main,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: theme.spacing(4),
    color: theme.palette.text.secondary,
    flex: 1,
  },
  emptyIcon: {
    fontSize: '3rem',
    color: theme.palette.action.disabled,
    marginBottom: theme.spacing(2),
  },
  linkButton: {
    marginTop: theme.spacing(1),
    textTransform: 'none',
  },
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1.5),
  },
  infoLabel: {
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.text.secondary,
    fontWeight: 500,
    minWidth: '120px',
  },
  infoValue: {
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.text.primary,
  },
}));
