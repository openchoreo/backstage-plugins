import { makeStyles } from '@material-ui/core/styles';
import { alpha } from '@material-ui/core/styles/colorManipulator';

export const useStyles = makeStyles(theme => ({
  section: {
    marginBottom: theme.spacing(3),
  },
  sectionTitle: {
    fontSize: theme.typography.h5.fontSize,
    fontWeight: 600,
    marginBottom: theme.spacing(2),
    color: theme.palette.text.primary,
  },
  propertyRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1.5),
  },
  propertyKey: {
    fontWeight: 600,
    color: theme.palette.text.secondary,
    fontSize: theme.typography.caption.fontSize,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    minWidth: '140px',
  },
  propertyValue: {
    color: theme.palette.text.primary,
    fontSize: theme.typography.body2.fontSize,
    wordBreak: 'break-word',
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
    fontFamily: 'monospace',
  },
  resourceCard: {
    padding: theme.spacing(2),
    backgroundColor: alpha(theme.palette.background.paper, 0.6),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
    marginBottom: theme.spacing(2),
  },
  resourceHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1.5),
  },
  resourceKind: {
    fontWeight: 600,
    fontSize: theme.typography.body1.fontSize,
  },
  healthyChip: {
    backgroundColor: theme.palette.success.light,
    color: theme.palette.success.dark,
    fontWeight: 500,
    fontSize: '0.75rem',
  },
  progressingChip: {
    backgroundColor: theme.palette.info.light,
    color: theme.palette.info.dark,
    fontWeight: 500,
    fontSize: '0.75rem',
  },
  degradedChip: {
    backgroundColor: theme.palette.error.light,
    color: theme.palette.error.dark,
    fontWeight: 500,
    fontSize: '0.75rem',
  },
  suspendedChip: {
    backgroundColor: theme.palette.warning.light,
    color: theme.palette.warning.dark,
    fontWeight: 500,
    fontSize: '0.75rem',
  },
  unknownChip: {
    backgroundColor: alpha(theme.palette.text.disabled, 0.1),
    color: theme.palette.text.secondary,
    fontWeight: 500,
    fontSize: '0.75rem',
  },
  conditionRow: {
    padding: theme.spacing(1.5),
    backgroundColor: alpha(
      theme.palette.type === 'dark'
        ? theme.palette.common.white
        : theme.palette.common.black,
      0.02,
    ),
    borderRadius: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  emptyValue: {
    color: theme.palette.text.disabled,
    fontStyle: 'italic',
    fontSize: theme.typography.body2.fontSize,
  },
  accordion: {
    backgroundColor: alpha(
      theme.palette.type === 'dark'
        ? theme.palette.common.white
        : theme.palette.common.black,
      0.02,
    ),
    '&:before': {
      display: 'none',
    },
    boxShadow: 'none',
    border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
    marginBottom: theme.spacing(1),
  },
}));

export type StyleClasses = ReturnType<typeof useStyles>;
