import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/test-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import type { Entity } from '@backstage/catalog-model';
import { CostInsightsSummaryCard } from './CostInsightsSummaryCard';

const mockUseNamespaceEnvironments = jest.fn();
const mockUseCostInsights = jest.fn();

jest.mock('./useNamespaceEnvironments', () => ({
  useNamespaceEnvironments: (...args: any[]) =>
    mockUseNamespaceEnvironments(...args),
}));
jest.mock('./useCostInsights', () => ({
  useCostInsights: (...args: any[]) => mockUseCostInsights(...args),
}));

const projectEntity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'System',
  metadata: {
    name: 'onlinestore',
    annotations: { [CHOREO_ANNOTATIONS.NAMESPACE]: 'default' },
  },
};

const componentEntity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'checkout',
    annotations: {
      [CHOREO_ANNOTATIONS.NAMESPACE]: 'default',
      [CHOREO_ANNOTATIONS.PROJECT]: 'onlinestore',
    },
  },
};

// A System with no openchoreo namespace annotation is not resolvable.
const unscopedEntity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'System',
  metadata: { name: 'orphan' },
};

const data = {
  level: 'project' as const,
  summary: {
    totalCost: 42,
    deltaPct: null,
    forecastThisMonth: 0,
    efficiency: 0,
    totalSaving: 0,
  },
  rows: [],
  series: [],
  seriesKeys: [],
};

const renderCard = (entity: Entity) =>
  renderInTestApp(
    <EntityProvider entity={entity}>
      <CostInsightsSummaryCard />
    </EntityProvider>,
  );

describe('CostInsightsSummaryCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseNamespaceEnvironments.mockReturnValue({
      environments: [{ name: 'dev' }],
      loading: false,
      error: null,
    });
    mockUseCostInsights.mockReturnValue({
      data,
      loading: false,
      error: null,
    });
  });

  it('shows the last-24h total and deep-links to the project scope', async () => {
    await renderCard(projectEntity);

    expect(screen.getByText('Cost Insights')).toBeInTheDocument();
    expect(screen.getByText('Last 24 hours')).toBeInTheDocument();
    expect(screen.getByText('USD 42.00')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /Go to Cost Insights/i });
    const href = link.getAttribute('href') ?? '';
    expect(href).toContain('/cost-insights?');
    expect(href).toContain('namespace=default');
    expect(href).toContain('project=onlinestore');
    expect(href).toContain('timeRange=24h');
    expect(href).not.toContain('component=');
  });

  it('scopes to the component and includes it in the deep link', async () => {
    await renderCard(componentEntity);

    // Derived component scope is passed to the cost hook.
    expect(mockUseCostInsights).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: {
          namespace: 'default',
          project: 'onlinestore',
          component: 'checkout',
        },
      }),
    );

    const link = screen.getByRole('link', { name: /Go to Cost Insights/i });
    expect(link.getAttribute('href')).toContain('component=checkout');
  });

  it('shows a loading skeleton instead of the total while fetching', async () => {
    mockUseCostInsights.mockReturnValue({
      data: undefined,
      loading: true,
      error: null,
    });
    await renderCard(projectEntity);

    expect(screen.queryByText('USD 42.00')).not.toBeInTheDocument();
    // The CTA still renders for a resolvable scope.
    expect(
      screen.getByRole('link', { name: /Go to Cost Insights/i }),
    ).toBeInTheDocument();
  });

  it('surfaces the error message when the cost query fails', async () => {
    mockUseCostInsights.mockReturnValue({
      data: undefined,
      loading: false,
      error: 'observer down',
    });
    await renderCard(projectEntity);

    expect(screen.getByText('observer down')).toBeInTheDocument();
  });

  it('falls back to a no-data note when there is no cost data', async () => {
    mockUseCostInsights.mockReturnValue({
      data: undefined,
      loading: false,
      error: null,
    });
    await renderCard(projectEntity);

    expect(screen.getByText('No cost data available')).toBeInTheDocument();
  });

  it('omits the deep-link CTA when the entity scope is unresolvable', async () => {
    await renderCard(unscopedEntity);

    expect(
      screen.queryByRole('link', { name: /Go to Cost Insights/i }),
    ).not.toBeInTheDocument();
    // The cost hook is called with no environments while unresolved.
    expect(mockUseCostInsights).toHaveBeenCalledWith(
      expect.objectContaining({ environments: [] }),
    );
  });
});
