import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderInTestApp } from '@backstage/test-utils';
import { Route, Routes, useLocation } from 'react-router-dom';
import { OpenChoreoPageLayout } from './OpenChoreoPageLayout';

/** Renders the current URL so a tab click can be asserted on. */
const LocationProbe = () => {
  const location = useLocation();
  return (
    <div data-testid="location">{`${location.pathname}${location.search}`}</div>
  );
};

const TabBody = ({ label }: { label: string }) => (
  <>
    <div data-testid="body">{label}</div>
    <LocationProbe />
  </>
);

// Sub-page hrefs are relative to the page, exactly as PageBlueprint passes them.
const TABS = [
  { id: 'overview', label: 'Overview', href: 'overview' },
  { id: 'logs', label: 'Logs', href: 'logs' },
];

/**
 * Mirrors how PageBlueprint mounts this: the layout sits *outside* the per-tab
 * `<Routes>`, under the page's own `/*` route — which is what makes
 * `useResolvedPath('.')` resolve to the page path rather than the active tab's.
 */
const PlatformPage = () => (
  <OpenChoreoPageLayout title="Platform" tabs={TABS}>
    <Routes>
      <Route path="overview/*" element={<TabBody label="overview" />} />
      <Route path="logs/*" element={<TabBody label="logs" />} />
    </Routes>
  </OpenChoreoPageLayout>
);

async function renderLayout(initialUrl: string) {
  await renderInTestApp(
    <Routes>
      <Route path="/platform-overview/*" element={<PlatformPage />} />
    </Routes>,
    { routeEntries: [initialUrl] },
  );
}

describe('OpenChoreoPageLayout', () => {
  it('renders the MUI page header and the contributed tabs', async () => {
    await renderLayout('/platform-overview/overview');

    expect(screen.getByText('Platform')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Logs' })).toBeInTheDocument();
  });

  it('marks the tab matching the current route as selected', async () => {
    await renderLayout('/platform-overview/logs');

    expect(screen.getByRole('tab', { name: 'Logs' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('resolves a relative tab href against the page path when navigating', async () => {
    await renderLayout('/platform-overview/overview');

    await userEvent.click(screen.getByRole('tab', { name: 'Logs' }));

    expect(screen.getByTestId('body')).toHaveTextContent('logs');
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/platform-overview/logs',
    );
  });

  // Each tab keeps its filters in the query string, and the tabs use disjoint
  // parameter names — so a round trip between them must not discard them.
  it('carries the query string across a tab switch', async () => {
    await renderLayout(
      '/platform-overview/overview?labels=openchoreo.dev%2Fplane%3Ddataplane',
    );

    await userEvent.click(screen.getByRole('tab', { name: 'Logs' }));

    expect(screen.getByTestId('location')).toHaveTextContent(
      'labels=openchoreo.dev%2Fplane%3Ddataplane',
    );
  });

  // Every OpenChoreo page sets `noHeader` and mounts its own <Page><Header>.
  it('renders nothing but the children when noHeader is set', async () => {
    await renderInTestApp(
      <OpenChoreoPageLayout title="Platform" noHeader tabs={TABS}>
        <div data-testid="body">bare</div>
      </OpenChoreoPageLayout>,
    );

    expect(screen.getByTestId('body')).toBeInTheDocument();
    expect(screen.queryByText('Platform')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });
});
