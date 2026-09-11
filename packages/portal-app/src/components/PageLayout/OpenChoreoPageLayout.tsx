import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate, useResolvedPath } from 'react-router-dom';
import { Header, HeaderTabs, Page } from '@backstage/core-components';
import type { PageLayoutProps } from '@backstage/frontend-plugin-api';
import { PluginHeader } from '@backstage/ui';

/** Joins a sub-page's (relative) href onto the page's own path. */
function resolveTabHref(href: string, parentPath: string) {
  return href.startsWith('/')
    ? href
    : `${parentPath}/${href}`.replace(/\/{2,}/g, '/');
}

/**
 * The app's `core.page-layout`.
 *
 * Upstream's implementation renders `@backstage/ui`'s `PluginHeader` — a BUI
 * toolbar — whenever a page asks for a header. Every OpenChoreo page sets
 * `noHeader: true` and mounts its own MUI `<Page><Header>` instead, so that BUI
 * chrome was never on screen until the Platform section started using Backstage's
 * sub-page tabs: a tabbed page gets its header from here, and `noHeader` is not
 * honoured on that path. The result was one page wearing a different header from
 * every other page in the app.
 *
 * So: `noHeader` short-circuits exactly as upstream (leaving every other page
 * untouched), a tabbed page gets the same purple `<Header>` + `<HeaderTabs>` chrome
 * the rest of the portal uses, and anything else falls through to upstream's
 * `PluginHeader` so non-OpenChoreo plugin pages keep their stock look.
 */
export const OpenChoreoPageLayout = (props: PageLayoutProps) => {
  const { title, icon, noHeader, titleLink, headerActions, tabs, children } =
    props;

  const navigate = useNavigate();
  const location = useLocation();
  const parentPath = useResolvedPath('.').pathname.replace(/\/$/, '');

  const hrefs = useMemo(
    () => (tabs ?? []).map(tab => resolveTabHref(tab.href, parentPath)),
    [tabs, parentPath],
  );

  // Same rule as BUI's own tab matching: prefix match, and where several tabs
  // match the most specific one wins.
  const selectedIndex = useMemo(() => {
    let best = -1;
    let bestSegments = -1;
    hrefs.forEach((href, index) => {
      const isMatch =
        location.pathname === href || location.pathname.startsWith(`${href}/`);
      const segments = href.split('/').filter(Boolean).length;
      if (isMatch && segments > bestSegments) {
        best = index;
        bestSegments = segments;
      }
    });
    return best === -1 ? 0 : best;
  }, [hrefs, location.pathname]);

  const handleTabChange = useCallback(
    (index: number) => {
      // Keep the query string. Each tab keeps its filters there and the tabs use
      // disjoint parameter names, so carrying it means a round trip between tabs
      // does not discard what the user had set up on the one they came from.
      navigate({ pathname: hrefs[index], search: location.search });
    },
    [navigate, hrefs, location.search],
  );

  if (noHeader) {
    return <>{children}</>;
  }

  if (tabs && tabs.length > 0) {
    return (
      <Page themeId="tool">
        <Header title={title}>{headerActions}</Header>
        <HeaderTabs
          selectedIndex={selectedIndex}
          onChange={handleTabChange}
          tabs={tabs.map(tab => ({ id: tab.id, label: tab.label }))}
        />
        {children}
      </Page>
    );
  }

  return (
    <>
      <PluginHeader
        title={title}
        icon={icon}
        titleLink={titleLink}
        customActions={headerActions}
      />
      {children}
    </>
  );
};
