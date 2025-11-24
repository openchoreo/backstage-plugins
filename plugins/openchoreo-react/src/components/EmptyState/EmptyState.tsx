import React, { ReactNode } from 'react';
import { Box, Typography, Button } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import InboxIcon from '@material-ui/icons/Inbox';

const useStyles = makeStyles(theme => ({
  container: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing(4),
    gap: theme.spacing(2),
  },
  icon: {
    fontSize: 64,
    color: theme.palette.text.disabled,
  },
  title: {
    color: theme.palette.text.primary,
    fontWeight: 600,
  },
  description: {
    color: theme.palette.text.secondary,
    textAlign: 'center',
    maxWidth: 600,
  },
}));

export interface EmptyStateProps {
  /**
   * Title text
   */
  title: string;
  /**
   * Optional description text
   */
  description?: string;
  /**
   * Optional custom icon (defaults to InboxIcon)
   */
  icon?: ReactNode;
  /**
   * Optional action button configuration
   */
  action?: {
    label: string;
    onClick: () => void;
  };
  /**
   * Minimum height of the container
   */
  minHeight?: string | number;
}

/**
 * Standardized empty state component for tables and lists
 *
 * @example
 * ```tsx
 * if (data.length === 0) {
 *   return (
 *     <EmptyState
 *       title="No items found"
 *       description="Try adjusting your filters or create a new item"
 *       action={{
 *         label: "Create Item",
 *         onClick: () => handleCreate()
 *       }}
 *     />
 *   );
 * }
 * ```
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  minHeight,
}) => {
  const classes = useStyles();

  return (
    <Box className={classes.container} style={{ minHeight }}>
      {icon || <InboxIcon className={classes.icon} />}
      <Typography variant="h6" className={classes.title}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" className={classes.description}>
          {description}
        </Typography>
      )}
      {action && (
        <Button variant="contained" color="primary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </Box>
  );
};
