import { Box, Typography } from '@material-ui/core';
import { useNotificationStyles } from '../styles';
import { NotificationBannerProps } from '../types';

/**
 * Fixed-position notification banner for success/error messages
 */
export const NotificationBanner = ({
  notification,
}: NotificationBannerProps) => {
  const classes = useNotificationStyles();

  if (!notification) {
    return null;
  }

  return (
    <Box
      position="fixed"
      top={80}
      right={24}
      zIndex={1300}
      maxWidth={400}
      className={`${classes.notificationBox} ${
        notification.type === 'success'
          ? classes.successNotification
          : classes.errorNotification
      }`}
    >
      <Typography variant="body2" style={{ fontWeight: 'bold' }}>
        {notification.type === 'success' ? '\u2713 ' : '\u2717 '}
        {notification.message}
      </Typography>
    </Box>
  );
};
