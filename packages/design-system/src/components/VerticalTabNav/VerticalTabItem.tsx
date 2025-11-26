import React from 'react';
import { Box, Typography } from '@material-ui/core';
import { useStyles } from './styles';

export interface TabItemData {
  /** Unique identifier for the tab */
  id: string;
  /** Display label for the tab */
  label: string;
  /** Optional icon to display before the label */
  icon?: React.ReactNode;
  /** Optional count to display as a badge */
  count?: number;
  /** Optional status indicator (colored dot) */
  status?: 'success' | 'warning' | 'error' | 'default';
  /** Whether the tab is disabled */
  disabled?: boolean;
}

interface VerticalTabItemProps {
  tab: TabItemData;
  isActive: boolean;
  onClick: () => void;
}

export const VerticalTabItem: React.FC<VerticalTabItemProps> = ({
  tab,
  isActive,
  onClick,
}) => {
  const classes = useStyles();

  const handleClick = () => {
    if (!tab.disabled) {
      onClick();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if ((event.key === 'Enter' || event.key === ' ') && !tab.disabled) {
      event.preventDefault();
      onClick();
    }
  };

  const getStatusClass = () => {
    switch (tab.status) {
      case 'success':
        return classes.statusSuccess;
      case 'warning':
        return classes.statusWarning;
      case 'error':
        return classes.statusError;
      default:
        return classes.statusDefault;
    }
  };

  return (
    <Box
      role="tab"
      aria-selected={isActive}
      aria-disabled={tab.disabled}
      tabIndex={tab.disabled ? -1 : 0}
      className={[
        classes.tabItem,
        isActive && classes.tabItemActive,
        tab.disabled && classes.tabItemDisabled,
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {tab.icon && <Box className={classes.tabIcon}>{tab.icon}</Box>}
      <Box className={classes.tabContent}>
        <Typography className={classes.tabLabel} component="span">
          {tab.label}
        </Typography>
      </Box>
      <Box className={classes.tabIndicators}>
        {tab.status && (
          <span className={`${classes.statusDot} ${getStatusClass()}`} />
        )}
        {tab.count !== undefined && (
          <span className={classes.countBadge}>{tab.count}</span>
        )}
      </Box>
    </Box>
  );
};
