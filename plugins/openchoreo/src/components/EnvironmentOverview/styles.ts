import { makeStyles } from '@material-ui/core/styles';

export const useEnvironmentOverviewStyles = makeStyles(theme => ({
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
    gap: theme.spacing(1),
    padding: theme.spacing(1.5),
    borderRadius: theme.spacing(1),
    backgroundColor: theme.palette.background.default,
  },
  statusItemClickable: {
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
      transform: 'translateY(-1px)',
    },
    '&:focus': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: '2px',
    },
  },
  statusIcon: {
    fontSize: '1.25rem',
  },
  statusHealthy: {
    color: theme.palette.success.main,
  },
  statusDegraded: {
    color: theme.palette.warning.main,
  },
  statusFailed: {
    color: theme.palette.error.main,
  },
  statusPending: {
    color: theme.palette.text.secondary,
  },
  statusCount: {
    fontWeight: 600,
    fontSize: theme.typography.h6.fontSize,
    color: theme.palette.text.primary,
  },
  statusLabel: {
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.text.secondary,
  },
  tableContainer: {
    marginTop: theme.spacing(2),
    '& th': {
      fontWeight: 600,
      backgroundColor: theme.palette.background.default,
    },
  },
  componentLink: {
    color: theme.palette.primary.main,
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  chip: {
    height: '24px',
    fontSize: '0.75rem',
  },
  chipActive: {
    backgroundColor: theme.palette.success.light,
    color: theme.palette.success.dark,
  },
  chipDegraded: {
    backgroundColor: theme.palette.warning.light,
    color: theme.palette.warning.dark,
  },
  chipFailed: {
    backgroundColor: theme.palette.error.light,
    color: theme.palette.error.dark,
  },
  chipPending: {
    backgroundColor: theme.palette.grey[200],
    color: theme.palette.grey[700],
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
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  infoLabel: {
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.text.secondary,
    fontWeight: 500,
    minWidth: '100px',
  },
  infoValue: {
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.text.primary,
  },
  linkButton: {
    marginTop: theme.spacing(1),
    textTransform: 'none',
  },
  pipelineFlow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
  environmentChip: {
    padding: theme.spacing(0.5, 1.5),
    borderRadius: theme.spacing(1),
    fontSize: theme.typography.body2.fontSize,
    fontWeight: 500,
    border: `1.5px solid ${theme.palette.primary.dark}`,
  },
  currentEnvironment: {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    border: `2px solid ${theme.palette.primary.dark}`,
  },
  otherEnvironment: {
    backgroundColor: theme.palette.primary.light,
    color: theme.palette.primary.dark,
  },
  arrow: {
    color: theme.palette.text.secondary,
    fontSize: '1rem',
  },
  dataPlaneInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginTop: theme.spacing(2),
    paddingTop: theme.spacing(2),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  dataPlaneIcon: {
    fontSize: '1.25rem',
    color: theme.palette.text.secondary,
  },
  dataPlaneLabel: {
    color: theme.palette.text.secondary,
  },
  dataPlaneLink: {
    color: theme.palette.primary.main,
    textDecoration: 'none',
    fontWeight: 500,
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  activityList: {
    padding: 0,
    margin: 0,
    listStyle: 'none',
  },
  activityItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 0),
    borderBottom: `1px solid ${theme.palette.divider}`,
    '&:last-child': {
      borderBottom: 'none',
    },
  },
  activityIcon: {
    fontSize: '1rem',
    marginTop: '2px',
  },
  activityText: {
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.text.primary,
    flex: 1,
  },
  activityTime: {
    fontSize: theme.typography.caption.fontSize,
    color: theme.palette.text.secondary,
  },
}));
