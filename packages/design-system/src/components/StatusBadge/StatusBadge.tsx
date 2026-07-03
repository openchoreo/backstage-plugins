import { makeStyles, Theme } from '@material-ui/core/styles';
import { Box, Typography } from '@material-ui/core';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import WarningRoundedIcon from '@material-ui/icons/WarningRounded';
import ErrorIcon from '@material-ui/icons/Error';
import InfoIcon from '@material-ui/icons/Info';
import RadioButtonUncheckedIcon from '@material-ui/icons/RadioButtonUnchecked';

const useStyles = makeStyles((theme: Theme) => ({
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 1.5),
    borderRadius: theme.spacing(2),
    fontSize: '0.875rem',
    fontWeight: 500,
    transition: 'all 0.2s ease-in-out',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  icon: {
    fontSize: 14,
    flexShrink: 0,
  },
  success: {
    backgroundColor: theme.palette.success.light,
    color: theme.palette.success.dark,
    '& $dot': {
      backgroundColor: theme.palette.success.main,
    },
  },
  warning: {
    backgroundColor: theme.palette.warning.light,
    color: theme.palette.warning.dark,
    '& $dot': {
      backgroundColor: theme.palette.warning.main,
    },
  },
  error: {
    backgroundColor: theme.palette.error.light,
    color: theme.palette.error.dark,
    '& $dot': {
      backgroundColor: theme.palette.error.main,
    },
  },
  info: {
    backgroundColor: `${theme.palette.primary.light}15`,
    color: theme.palette.primary.dark,
    '& $dot': {
      backgroundColor: theme.palette.primary.main,
    },
  },
  default: {
    backgroundColor: theme.palette.secondary.light,
    color: theme.palette.secondary.main,
    '& $dot': {
      backgroundColor: theme.palette.secondary.main,
    },
  },
}));

export type StatusType =
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'default'
  | 'active'
  | 'pending'
  | 'failed'
  | 'not-deployed'
  | 'undeployed'
  | 'suspended'
  | 'unknown';

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  /** Render a coloured dot before the label (default: true). */
  showDot?: boolean;
  /**
   * Render a variant-specific glyph before the label so colour is not the
   * sole differentiator (WCAG 1.4.1). When `showIcon` is true, the dot is
   * suppressed. Default: false (preserves existing visual).
   */
  showIcon?: boolean;
}

const VARIANT_ICON: Record<
  'success' | 'warning' | 'error' | 'info' | 'default',
  typeof CheckCircleIcon
> = {
  success: CheckCircleIcon,
  warning: WarningRoundedIcon,
  error: ErrorIcon,
  info: InfoIcon,
  default: RadioButtonUncheckedIcon,
};

const STATUS_CONFIG: Record<
  StatusType,
  {
    variant: 'success' | 'warning' | 'error' | 'info' | 'default';
    defaultLabel: string;
  }
> = {
  success: { variant: 'success', defaultLabel: 'Success' },
  active: { variant: 'success', defaultLabel: 'Active' },
  warning: { variant: 'warning', defaultLabel: 'Warning' },
  pending: { variant: 'warning', defaultLabel: 'Pending' },
  unknown: { variant: 'warning', defaultLabel: 'Unknown' },
  error: { variant: 'error', defaultLabel: 'Error' },
  failed: { variant: 'error', defaultLabel: 'Failed' },
  info: { variant: 'info', defaultLabel: 'Info' },
  default: { variant: 'default', defaultLabel: 'Default' },
  'not-deployed': { variant: 'default', defaultLabel: 'Not Deployed' },
  undeployed: { variant: 'default', defaultLabel: 'Undeployed' },
  suspended: { variant: 'warning', defaultLabel: 'Suspended' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  showDot = true,
  showIcon = false,
}) => {
  const classes = useStyles();
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.default;
  const displayLabel = label || config.defaultLabel;
  const Icon = VARIANT_ICON[config.variant];

  return (
    <Box className={`${classes.badge} ${classes[config.variant]}`}>
      {showIcon ? (
        <Icon className={classes.icon} aria-hidden="true" />
      ) : (
        showDot && <span className={classes.dot} />
      )}
      <Typography component="span" variant="body2">
        {displayLabel}
      </Typography>
    </Box>
  );
};
