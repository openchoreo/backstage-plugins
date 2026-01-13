import React from 'react';
import { Box } from '@material-ui/core';
import { VerticalTabItem, TabItemData } from './VerticalTabItem';
import { useStyles } from './styles';

export interface VerticalTabNavProps {
  /** Array of tab items to display */
  tabs: TabItemData[];
  /** ID of the currently active tab */
  activeTabId: string;
  /** Callback when a tab is selected */
  onChange: (tabId: string) => void;
  /** Content to display in the panel (typically conditional based on activeTabId) */
  children: React.ReactNode;
  /** Optional className for the container */
  className?: string;
}

/**
 * VerticalTabNav - A vertical tab navigation component with a fixed left sidebar
 *
 * Features:
 * - Fixed-width left sidebar with vertical tab list
 * - Scrollable content panel on the right
 * - Support for icons, count badges, and status indicators on tabs
 * - Keyboard accessible (Enter/Space to select, Tab to navigate)
 * - ARIA roles for accessibility
 *
 * @example
 * ```tsx
 * const [activeTab, setActiveTab] = useState('containers');
 *
 * <VerticalTabNav
 *   tabs={[
 *     { id: 'containers', label: 'Containers', count: 2 },
 *     { id: 'endpoints', label: 'Endpoints', count: 1, status: 'success' },
 *   ]}
 *   activeTabId={activeTab}
 *   onChange={setActiveTab}
 * >
 *   {activeTab === 'containers' && <ContainersContent />}
 *   {activeTab === 'endpoints' && <EndpointsContent />}
 * </VerticalTabNav>
 * ```
 */
export const VerticalTabNav: React.FC<VerticalTabNavProps> = ({
  tabs,
  activeTabId,
  onChange,
  children,
  className,
}) => {
  const classes = useStyles();

  return (
    <Box className={[classes.container, className].filter(Boolean).join(' ')}>
      <Box
        role="tablist"
        aria-orientation="vertical"
        className={classes.tabList}
      >
        {tabs.map(tab => (
          <VerticalTabItem
            key={tab.id}
            tab={tab}
            isActive={activeTabId === tab.id}
            onClick={onChange}
            activeTabId={activeTabId}
          />
        ))}
      </Box>
      <Box
        role="tabpanel"
        aria-labelledby={activeTabId}
        className={classes.contentPanel}
      >
        {children}
      </Box>
    </Box>
  );
};

VerticalTabNav.displayName = 'VerticalTabNav';
