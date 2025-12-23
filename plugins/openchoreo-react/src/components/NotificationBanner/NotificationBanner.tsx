import React from 'react';
import { Box, Typography, IconButton } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import CloseIcon from '@material-ui/icons/Close';
import InfoIcon from '@material-ui/icons/InfoOutlined';
import CheckCircleIcon from '@material-ui/icons/CheckCircleOutlined';
import WarningIcon from '@material-ui/icons/ReportProblemOutlined';
import ErrorIcon from '@material-ui/icons/ErrorOutlined';

export type NotificationVariant =
  | 'primary'
  | 'info'
  | 'error'
  | 'warning'
  | 'success'
  | 'secondary';

export interface NotificationBannerProps {
  /** Notification message (required) - can be string or React element */
  message: React.ReactNode;
  /** Optional notification title */
  title?: string;
  /** Variant determines the color scheme */
  variant?: NotificationVariant;
  /** Whether to show an icon */
  showIcon?: boolean;
  /** Optional close handler */
  onClose?: () => void;
  /** Additional className */
  className?: string;
}

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(2),
    borderLeft: `4px solid`,
    backgroundColor: theme.palette.background.paper,
    position: 'relative',
    gap: theme.spacing(1),
  },
  primary: {
    borderLeftColor: theme.palette.primary.main,
    backgroundColor: theme.palette.primary.light,
  },
  info: {
    borderLeftColor: theme.palette.info.main,
    backgroundColor: theme.palette.info.light + '15',
  },
  error: {
    borderLeftColor: theme.palette.error.main,
    backgroundColor: theme.palette.error.light,
  },
  warning: {
    borderLeftColor: theme.palette.warning.main,
    backgroundColor: theme.palette.warning.light,
  },
  success: {
    borderLeftColor: theme.palette.success.main,
    backgroundColor: theme.palette.success.light + '15',
  },
  secondary: {
    borderLeftColor: theme.palette.grey[500],
    backgroundColor: theme.palette.grey[100],
  },
  iconContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    flexShrink: 0,
  },
  // iconContainerPrimary: {
  //   backgroundColor: theme.palette.primary.light + '40',
  // },
  // iconContainerInfo: {
  //   backgroundColor: theme.palette.info.light + '40',
  // },
  // iconContainerError: {
  //   backgroundColor: theme.palette.error.light + '40',
  // },
  // iconContainerWarning: {
  //   backgroundColor: theme.palette.warning.light + '40',
  // },
  // iconContainerSuccess: {
  //   backgroundColor: theme.palette.success.light + '40',
  // },
  iconContainerSecondary: {
    backgroundColor: theme.palette.grey[300],
  },
  iconPrimary: {
    color: theme.palette.primary.main,
  },
  iconInfo: {
    color: theme.palette.info.main,
  },
  iconError: {
    color: theme.palette.error.main,
  },
  iconWarning: {
    color: theme.palette.warning.main,
  },
  iconSuccess: {
    color: theme.palette.success.main,
  },
  iconSecondary: {
    color: theme.palette.grey[700],
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    // gap: theme.spacing(0.5),
  },
  title: {
    fontWeight: 600,
    fontSize: '1rem',
    color: theme.palette.text.primary,
  },
  message: {
    fontSize: '0.875rem',
    color: theme.palette.text.secondary,
  },
  closeButton: {
    padding: theme.spacing(0.5),
    marginTop: -theme.spacing(0.5),
    marginRight: -theme.spacing(0.5),
  },
}));

const getIcon = (variant: NotificationVariant) => {
  switch (variant) {
    case 'primary':
      return InfoIcon;
    case 'info':
      return InfoIcon;
    case 'error':
      return ErrorIcon;
    case 'warning':
      return WarningIcon;
    case 'success':
      return CheckCircleIcon;
    case 'secondary':
      return InfoIcon;
    default:
      return InfoIcon;
  }
};

/**
 * NotificationBanner component for displaying notifications with different variants.
 *
 * @example
 * ```tsx
 * <NotificationBanner
 *   variant="success"
 *   title="Success!"
 *   message="Your action completed successfully"
 *   showIcon
 *   onClose={() => console.log('close')}
 * />
 * ```
 */
export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  message,
  title,
  variant = 'primary',
  showIcon = false,
  onClose,
  className,
}) => {
  const classes = useStyles();
  const IconComponent = getIcon(variant);

  const variantClass = classes[variant];
  // const iconContainerClass = classes[`iconContainer${variant.charAt(0).toUpperCase()}${variant.slice(1)}` as keyof typeof classes];
  const iconClass = classes[`icon${variant.charAt(0).toUpperCase()}${variant.slice(1)}` as keyof typeof classes];

  return (
    <Box className={`${classes.root} ${variantClass} ${className || ''}`}>
      {showIcon && (
        <Box className={classes.iconContainer}>
          <IconComponent className={iconClass} fontSize="small" />
        </Box>
      )}

      <Box className={classes.content}>
        {title && <Typography className={classes.title}>{title}</Typography>}
        <Box className={classes.message}>{message}</Box>
      </Box>

      {onClose && (
        <IconButton
          size="small"
          onClick={onClose}
          className={classes.closeButton}
          aria-label="close"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      )}
    </Box>
  );
};
