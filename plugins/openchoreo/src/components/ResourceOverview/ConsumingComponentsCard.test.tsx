import { render, screen, waitFor } from '@testing-library/react';
import { EntityProvider, catalogApiRef } from '@backstage/plugin-catalog-react';
import type { Entity } from '@backstage/catalog-model';
import { TestApiProvider } from '@backstage/test-utils';
import { ConsumingComponentsCard } from './ConsumingComponentsCard';

jest.mock('@backstage/core-components', () => ({
  Progress: () => <div data-testid="progress" />,
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

jest.mock('@openchoreo/backstage-design-system', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  PageLoader: () => <div data-testid="progress" />,
}));

jest.mock('../DataplaneOverview/styles', () => ({
  useDataplaneOverviewStyles: () => ({
    card: '',
    cardHeader: '',
    statusValue: '',
    infoRow: '',
    infoValue: '',
  }),
}));

jest.mock('../Environments/OverviewCard/styles', () => ({
  useOverviewCardStyles: () => ({
    environmentChips: '',
  }),
}));

function makeResource(): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Resource',
    metadata: { name: 'analytics-db', namespace: 'finance' },
    spec: { type: 'postgres' } as any,
  };
}

function makeComponent(
  name: string,
  namespace = 'finance',
  title?: string,
): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: { name, namespace, ...(title && { title }) },
    spec: { type: 'service' } as any,
  };
}

function renderCard(catalogApi: { getEntities: jest.Mock }) {
  return render(
    <TestApiProvider apis={[[catalogApiRef, catalogApi as any]]}>
      <EntityProvider entity={makeResource()}>
        <ConsumingComponentsCard />
      </EntityProvider>
    </TestApiProvider>,
  );
}

describe('ConsumingComponentsCard', () => {
  it('queries the catalog with the resource entity ref under relations.dependson', () => {
    const getEntities = jest.fn(() => new Promise(() => {}));
    renderCard({ getEntities });
    expect(getEntities).toHaveBeenCalledWith({
      filter: {
        kind: 'Component',
        'relations.dependson': 'resource:finance/analytics-db',
      },
    });
  });

  it('shows a progress indicator while components are loading', () => {
    const getEntities = jest.fn(() => new Promise(() => {}));
    renderCard({ getEntities });
    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });

  it('renders one link per consuming component', async () => {
    const getEntities = jest.fn().mockResolvedValue({
      items: [
        makeComponent('api-service', 'finance', 'API Service'),
        makeComponent('worker'),
      ],
    });
    renderCard({ getEntities });

    await waitFor(() => {
      expect(screen.getByText('API Service')).toBeInTheDocument();
    });
    expect(screen.getByText('worker')).toBeInTheDocument();
    expect(screen.getByText('API Service').closest('a')).toHaveAttribute(
      'href',
      '/catalog/finance/component/api-service',
    );
  });

  it('renders the empty-state when no consumers exist', async () => {
    const getEntities = jest.fn().mockResolvedValue({ items: [] });
    renderCard({ getEntities });

    await waitFor(() => {
      expect(screen.getByText('No consuming components.')).toBeInTheDocument();
    });
  });

  it('renders an error message when the catalog query rejects', async () => {
    const getEntities = jest.fn().mockRejectedValue(new Error('catalog down'));
    renderCard({ getEntities });

    await waitFor(() => {
      expect(
        screen.getByText('Failed to load consuming components: catalog down'),
      ).toBeInTheDocument();
    });
  });
});
