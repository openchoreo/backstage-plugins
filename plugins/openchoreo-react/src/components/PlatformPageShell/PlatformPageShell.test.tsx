import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderInTestApp } from '@backstage/test-utils';
import { Content } from '@backstage/core-components';
import { Routes, Route, useLocation } from 'react-router-dom';
import { PlatformPageShell } from './PlatformPageShell';

/** Renders the current URL so a tab click can be asserted on. */
const LocationProbe = () => {
  const location = useLocation();
  return (
    <div data-testid="location">{`${location.pathname}${location.search}`}</div>
  );
};

const shellAt = (label: string) => (
  <PlatformPageShell>
    <Content>
      <div data-testid="tab-body">{label}</div>
      <LocationProbe />
    </Content>
  </PlatformPageShell>
);

async function renderShell(initialUrl: string) {
  await renderInTestApp(
    <Routes>
      <Route path="/platform-overview" element={shellAt('overview')} />
      <Route path="/platform-overview/logs" element={shellAt('logs')} />
    </Routes>,
    { routeEntries: [initialUrl] },
  );
}

describe('PlatformPageShell', () => {
  it('renders both Platform tabs under one title', async () => {
    await renderShell('/platform-overview');

    expect(screen.getByText('Platform')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Logs' })).toBeInTheDocument();
  });

  it('marks the tab matching the current route as selected', async () => {
    await renderShell('/platform-overview/logs');

    expect(screen.getByRole('tab', { name: 'Logs' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('navigates to the logs route when the Logs tab is clicked', async () => {
    await renderShell('/platform-overview');

    await userEvent.click(screen.getByRole('tab', { name: 'Logs' }));

    expect(screen.getByTestId('tab-body')).toHaveTextContent('logs');
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/platform-overview/logs',
    );
  });

  // Each tab keeps its filters in the query string, and the two use disjoint
  // parameter names — so a round-trip between tabs must not discard them.
  it('carries the query string across a tab switch', async () => {
    await renderShell(
      '/platform-overview?labels=openchoreo.dev%2Fplane%3Ddataplane',
    );

    await userEvent.click(screen.getByRole('tab', { name: 'Logs' }));

    expect(screen.getByTestId('location')).toHaveTextContent(
      'labels=openchoreo.dev%2Fplane%3Ddataplane',
    );
  });
});
