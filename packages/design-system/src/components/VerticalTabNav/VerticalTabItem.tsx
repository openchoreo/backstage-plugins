import React, { useState } from 'react';
import { Box, Typography, Collapse } from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
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
  status?: 'success' | 'warning' | 'error' | 'info' | 'default';
  /** Whether the tab is disabled */
  disabled?: boolean;
  /** Optional children tabs for creating collapsible groups */
  children?: TabItemData[];
  /** Whether this is a group item (collapsible) */
  isGroup?: boolean;
}

interface VerticalTabItemProps {
  tab: TabItemData;
  isActive: boolean;
  onClick: (tabId: string) => void;
  activeTabId?: string;
  level?: number;
}

export const VerticalTabItem: React.FC<VerticalTabItemProps> = ({
  tab,
  isActive,
  onClick,
  activeTabId,
  level = 0,
}) => {
  const classes = useStyles();
  const [expanded, setExpanded] = useState(true);

  const isGroup = tab.isGroup || (tab.children && tab.children.length > 0);
  // const hasActiveChild = tab.children?.some(
  //   child => child.id === activeTabId || child.children?.some(c => c.id === activeTabId)
  // );

  const handleClick = () => {
    if (isGroup) {
      setExpanded(!expanded);
    } else if (!tab.disabled) {
      onClick(tab.id);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if ((event.key === 'Enter' || event.key === ' ') && !tab.disabled) {
      event.preventDefault();
      if (isGroup) {
        setExpanded(!expanded);
      } else {
        onClick(tab.id);
      }
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
      case 'info':
        return classes.statusInfo;
      default:
        return classes.statusDefault;
    }
  };

  // Calculate padding: base padding + level offset + icon space if nested without icon
  const iconSpace = 16; // Icon width (20px) + gap (12px)
  const basePadding = 16;
  const levelOffset = level * 16;

  // If nested (level > 0) and no icon, add icon space to align with parent text
  const extraPadding = level > 0 && !tab.icon ? iconSpace : 0;
  const paddingLeft = basePadding + levelOffset + extraPadding;

  return (
    <>
      <Box
        role="tab"
        aria-selected={isActive}
        aria-disabled={tab.disabled}
        tabIndex={tab.disabled ? -1 : 0}
        className={[
          classes.tabItem,
          isActive && classes.tabItemActive,
          tab.disabled && classes.tabItemDisabled,
          isGroup && classes.tabItemGroup,
          level > 0 && classes.tabItemNested,
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        style={{ paddingLeft: `${paddingLeft}px` }}
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
          {isGroup && (
            <Box
              className={[
                classes.expandIcon,
                expanded && classes.expandIconExpanded,
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <ExpandMoreIcon fontSize="small" />
            </Box>
          )}
        </Box>
      </Box>
      {isGroup && tab.children && (
        <Collapse in={expanded}>
          {tab.children.map(child => (
            <VerticalTabItem
              key={child.id}
              tab={child}
              isActive={child.id === activeTabId}
              onClick={onClick}
              activeTabId={activeTabId}
              level={level + 1}
            />
          ))}
        </Collapse>
      )}
    </>
  );
};
