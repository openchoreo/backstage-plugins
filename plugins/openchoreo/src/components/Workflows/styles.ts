import { makeStyles } from '@material-ui/core/styles';
import { alpha } from '@material-ui/core/styles/colorManipulator';

export const useWorkflowStyles = makeStyles(theme => ({
  workflowCard: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  headerTitle: {
    fontWeight: 600,
    fontSize: theme.typography.h5.fontSize,
  },
  propertyCard: {
    padding: theme.spacing(1.5),
    backgroundColor: alpha(theme.palette.background.paper, 0.6),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
    height: '100%',
    transition: 'all 0.2s ease',
    '&:hover': {
      backgroundColor: alpha(theme.palette.background.paper, 0.8),
      borderColor: theme.palette.divider,
    },
  },
  propertyRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  propertyKey: {
    fontWeight: 600,
    color: theme.palette.text.secondary,
    fontSize: theme.typography.caption.fontSize,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    whiteSpace: 'nowrap',
  },
  propertyValue: {
    color: theme.palette.text.primary,
    fontSize: theme.typography.body2.fontSize,
    wordBreak: 'break-word',
    lineHeight: 1.6,
    flex: 1,
    minWidth: 0,
  },
  propertyValueCode: {
    backgroundColor: alpha(
      theme.palette.type === 'dark'
        ? theme.palette.common.white
        : theme.palette.common.black,
      0.05,
    ),
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.spacing(0.5),
    fontSize: '0.875rem',
  },
  emptyValue: {
    color: theme.palette.text.disabled,
    fontStyle: 'italic',
    fontSize: theme.typography.body2.fontSize,
  },
  nestedSection: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(2),
    backgroundColor: alpha(
      theme.palette.type === 'dark'
        ? theme.palette.common.white
        : theme.palette.common.black,
      0.02,
    ),
    borderRadius: theme.shape.borderRadius,
  },
  nestedSectionTitle: {
    fontSize: theme.typography.h5.fontSize,
    fontWeight: theme.typography.h5.fontWeight,
    marginBottom: theme.spacing(1.5),
    color: theme.palette.text.primary,
  },
  linkValue: {
    color: theme.palette.primary.main,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    fontSize: theme.typography.body2.fontSize,
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  emptyStateCard: {
    padding: theme.spacing(3),
    textAlign: 'center',
    backgroundColor: alpha(theme.palette.background.paper, 0.4),
    border: `1px dashed ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
  },
  statusChip: {
    fontWeight: 500,
    fontSize: '0.8125rem',
    height: '24px',
  },
  successChip: {
    backgroundColor: theme.palette.success.light,
    color: theme.palette.success.dark,
    '& .MuiChip-icon': {
      color: `${theme.palette.success.dark} !important`,
    },
  },
  errorChip: {
    backgroundColor: theme.palette.error.light,
    color: theme.palette.error.dark,
    '& .MuiChip-icon': {
      color: `${theme.palette.error.dark} !important`,
    },
  },
  runningChip: {
    backgroundColor: theme.palette.secondary.light,
    color: theme.palette.info.dark,
    '& .MuiChip-icon': {
      color: `${theme.palette.info.dark} !important`,
    },
  },
  pendingChip: {
    backgroundColor: theme.palette.warning.light,
    color: theme.palette.warning.dark,
    '& .MuiChip-icon': {
      color: `${theme.palette.warning.dark} !important`,
    },
  },
}));
