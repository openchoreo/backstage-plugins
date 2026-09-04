import { screen, fireEvent } from '@testing-library/react';
import { renderInTestApp } from '@backstage/test-utils';
import { DeliveryInsightsPage } from './DeliveryInsightsPage';
import type { DeliveryInsightsContentProps } from './DeliveryInsightsContent';

// The breadcrumb and the metrics surface have their own suites; stub them so
// this one focuses on the page's URL <-> state wiring. Each stub records the
// props it received and exposes buttons that fire its callbacks, so a
// round-trip through the URL can be asserted from the next render's props.
let lastProps: DeliveryInsightsContentProps;

jest.mock('../ScopeBreadcrumb', () => ({
  ScopeBreadcrumb: ({ onScopeChange }: any) => (
    <button
      type="button"
      data-testid="breadcrumb"
      onClick={() => onScopeChange({ namespace: 'other' })}
    >
      switch-namespace
    </button>
  ),
}));

jest.mock('./DeliveryInsightsContent', () => ({
  DeliveryInsightsContent: (props: DeliveryInsightsContentProps) => {
    lastProps = props;
    return (
      <div data-testid="content">
        <button type="button" onClick={() => props.onDrill?.('checkout')}>
          drill
        </button>
        <button type="button" onClick={() => props.onRangeDaysChange(90)}>
          range-90
        </button>
        <button
          type="button"
          onClick={() => props.onGranularityChange('weekly')}
        >
          gran-weekly
        </button>
        <button type="button" onClick={() => props.onEnvFilterChange('prod')}>
          env-prod
        </button>
      </div>
    );
  },
}));

const renderPage = (route = '/') =>
  renderInTestApp(<DeliveryInsightsPage />, { routeEntries: [route] });

describe('DeliveryInsightsPage', () => {
  it('defaults to the org-wide (namespace) scope', async () => {
    await renderPage();
    expect(screen.getByText('Delivery Insights')).toBeInTheDocument();
    expect(screen.getByText('namespace')).toBeInTheDocument();
    expect(lastProps.scope).toEqual({
      namespace: 'default',
      project: undefined,
      component: undefined,
    });
    expect(lastProps.level).toBe('domain');
  });

  it('derives the project level from the URL', async () => {
    await renderPage('/?namespace=acme&project=checkout');
    expect(screen.getByText('project')).toBeInTheDocument();
    expect(lastProps.level).toBe('system');
    expect(lastProps.scope).toMatchObject({
      namespace: 'acme',
      project: 'checkout',
    });
  });

  it('derives the component level from the URL', async () => {
    await renderPage('/?namespace=acme&project=checkout&component=api');
    expect(screen.getByText('component')).toBeInTheDocument();
    expect(lastProps.level).toBe('component');
    expect(lastProps.scope).toMatchObject({
      namespace: 'acme',
      project: 'checkout',
      component: 'api',
    });
  });

  it('ignores a component without a project, since it would be ambiguous', async () => {
    await renderPage('/?namespace=acme&component=api');
    expect(lastProps.scope?.component).toBeUndefined();
    expect(lastProps.level).toBe('domain');
  });

  it('reads range, granularity and environment from the URL', async () => {
    await renderPage('/?range=90&granularity=monthly&env=prod');
    expect(lastProps.rangeDays).toBe(90);
    expect(lastProps.granularity).toBe('monthly');
    expect(lastProps.envFilter).toBe('prod');
  });

  it('falls back to defaults for unsupported range and granularity values', async () => {
    await renderPage('/?range=13&granularity=hourly');
    expect(lastProps.rangeDays).toBe(30);
    expect(lastProps.granularity).toBe('daily');
  });

  it('drills from namespace level into the clicked project', async () => {
    await renderPage('/?namespace=acme');
    fireEvent.click(screen.getByText('drill'));
    expect(lastProps.scope).toMatchObject({
      namespace: 'acme',
      project: 'checkout',
    });
    expect(lastProps.level).toBe('system');
  });

  it('drills from project level into the clicked component', async () => {
    await renderPage('/?namespace=acme&project=payments');
    fireEvent.click(screen.getByText('drill'));
    expect(lastProps.scope).toMatchObject({
      namespace: 'acme',
      project: 'payments',
      component: 'checkout',
    });
    expect(lastProps.level).toBe('component');
  });

  it('persists filter changes so the view can be shared', async () => {
    await renderPage();
    fireEvent.click(screen.getByText('range-90'));
    expect(lastProps.rangeDays).toBe(90);

    fireEvent.click(screen.getByText('gran-weekly'));
    expect(lastProps.granularity).toBe('weekly');

    fireEvent.click(screen.getByText('env-prod'));
    expect(lastProps.envFilter).toBe('prod');
    // The other filters survive an unrelated change.
    expect(lastProps.rangeDays).toBe(90);
    expect(lastProps.granularity).toBe('weekly');
  });

  it('clears the environment filter when the namespace changes', async () => {
    await renderPage('/?namespace=acme&project=checkout&env=prod');
    expect(lastProps.envFilter).toBe('prod');

    // Environment names are namespace-scoped, so carrying the filter across a
    // namespace switch would silently return no data. The deeper project
    // selection is dropped too.
    fireEvent.click(screen.getByTestId('breadcrumb'));
    expect(lastProps.scope).toMatchObject({ namespace: 'other' });
    expect(lastProps.scope?.project).toBeUndefined();
    expect(lastProps.envFilter).toBe('');
  });

  it('keeps the environment filter when drilling within a namespace', async () => {
    await renderPage('/?namespace=acme&env=prod');
    fireEvent.click(screen.getByText('drill'));
    expect(lastProps.scope).toMatchObject({
      namespace: 'acme',
      project: 'checkout',
    });
    expect(lastProps.envFilter).toBe('prod');
  });
});
