import { Box, Typography, IconButton } from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import InfoIcon from '@material-ui/icons/InfoOutlined';
import CheckCircleIcon from '@material-ui/icons/CheckCircleOutlined';
import WarningIcon from '@material-ui/icons/ReportProblemOutlined';
import ErrorIcon from '@material-ui/icons/ErrorOutlined';
import { useStyles } from './styles';

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
  const iconClass =
    classes[
      `icon${variant.charAt(0).toUpperCase()}${variant.slice(
        1,
      )}` as keyof typeof classes
    ];

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
