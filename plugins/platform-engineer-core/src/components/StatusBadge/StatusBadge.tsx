import React from 'react';
import { makeStyles, Theme } from '@material-ui/core/styles';
import { Box, Typography } from '@material-ui/core';

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
  success: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    color: '#2E7D32',
    '& $dot': {
      backgroundColor: '#4CAF50',
    },
  },
  warning: {
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    color: '#E65100',
    '& $dot': {
      backgroundColor: '#FF9800',
    },
  },
  error: {
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    color: '#C62828',
    '& $dot': {
      backgroundColor: '#F44336',
    },
  },
  info: {
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    color: '#1565C0',
    '& $dot': {
      backgroundColor: '#2196F3',
    },
  },
  default: {
    backgroundColor: 'rgba(117, 117, 117, 0.1)',
    color: '#616161',
    '& $dot': {
      backgroundColor: '#757575',
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
  | 'unknown';

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  showDot?: boolean;
}

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
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  showDot = true,
}) => {
  const classes = useStyles();
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.default;
  const displayLabel = label || config.defaultLabel;

  return (
    <Box className={`${classes.badge} ${classes[config.variant]}`}>
      {showDot && <span className={classes.dot} />}
      <Typography component="span" variant="body2">
        {displayLabel}
      </Typography>
    </Box>
  );
};
