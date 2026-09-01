import { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Page, Header, HeaderTabs } from '@backstage/core-components';

/** Base path of the Platform section. */
export const PLATFORM_PATH = '/platform-overview';

const TABS = [
  { id: 'overview', label: 'Overview', path: PLATFORM_PATH },
  { id: 'logs', label: 'Logs', path: `${PLATFORM_PATH}/logs` },
];

export interface PlatformPageShellProps {
  /** Optional header subtitle; each tab supplies its own. */
  subtitle?: ReactNode;
  /** The tab's own `<Content>`. */
  children: ReactNode;
}

/**
 * Page chrome shared by the Platform tabs: the title, the tab bar, and nothing else.
 *
 * The tabs are routes rather than local state, so a tab is linkable and the browser's
 * back button moves between them. Each tab keeps its own `<Content>` because their
 * layouts differ — the graph view fills the viewport with no padding, the logs table
 * does not.
 */
export const PlatformPageShell = ({
  subtitle,
  children,
}: PlatformPageShellProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const selectedIndex = location.pathname.replace(/\/+$/, '').endsWith('/logs')
    ? 1
    : 0;

  return (
    <Page themeId="tool">
      <Header title="Platform" subtitle={subtitle} />
      <HeaderTabs
        selectedIndex={selectedIndex}
        onChange={index =>
          // The query string carries each tab's filters, and the two tabs use
          // disjoint parameter names, so keeping it means a tab round-trip does not
          // discard what the user had set up on the tab they came from.
          navigate({ pathname: TABS[index].path, search: location.search })
        }
        tabs={TABS.map(({ id, label }) => ({ id, label }))}
      />
      {children}
    </Page>
  );
};
