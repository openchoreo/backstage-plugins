import { render, screen, waitFor } from '@testing-library/react';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import type { Entity } from '@backstage/catalog-model';
import { TestApiProvider } from '@backstage/test-utils';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';
import { ResourceBindingsCard } from './ResourceBindingsCard';

jest.mock('@backstage/core-components', () => ({
  Progress: () => <div data-testid="progress" />,
}));

jest.mock('@openchoreo/backstage-design-system', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  StatusBadge: ({ status }: any) => (
    <span data-testid="status-badge">{status}</span>
  ),
}));

jest.mock('../DataplaneOverview/styles', () => ({
  useDataplaneOverviewStyles: () => ({
    card: '',
    cardHeader: '',
    statusValue: '',
    statusLabel: '',
    statusHealthy: 'status-ready',
    statusWarning: 'status-notready',
    statusError: 'status-failed',
    infoRow: '',
    infoLabel: '',
    infoValue: '',
  }),
}));

function makeEntity(): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Resource',
    metadata: {
      name: 'analytics-db',
      namespace: 'finance',
      annotations: {
        'openchoreo.io/namespace': 'finance',
        'openchoreo.io/project': 'analytics',
        'openchoreo.io/resource': 'analytics-db',
      },
    },
    spec: { type: 'postgres' } as any,
  };
}

function renderCard(client: { fetchResourceReleaseBindings: jest.Mock }) {
  return render(
    <TestApiProvider apis={[[openChoreoClientApiRef, client as any]]}>
      <EntityProvider entity={makeEntity()}>
        <ResourceBindingsCard />
      </EntityProvider>
    </TestApiProvider>,
  );
}

describe('ResourceBindingsCard', () => {
  it('shows a progress indicator while bindings are loading', () => {
    const client = {
      fetchResourceReleaseBindings: jest.fn(() => new Promise(() => {})),
    };
    renderCard(client);
    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });

  it('renders one row per binding with environment, release, and status', async () => {
    const client = {
      fetchResourceReleaseBindings: jest.fn().mockResolvedValue({
        success: true,
        data: {
          items: [
            {
              name: 'analytics-db-dev',
              environment: 'dev',
              resourceName: 'analytics-db',
              projectName: 'analytics',
              releaseName: 'analytics-db-abc123',
              status: 'Ready',
            },
            {
              name: 'analytics-db-prod',
              environment: 'prod',
              resourceName: 'analytics-db',
              projectName: 'analytics',
              releaseName: 'analytics-db-def456',
              status: 'NotReady',
            },
          ],
        },
      }),
    };

    renderCard(client);

    await waitFor(() => {
      expect(screen.getByText('dev')).toBeInTheDocument();
    });
    expect(screen.getByText('prod')).toBeInTheDocument();
    expect(screen.getByText('analytics-db-abc123')).toBeInTheDocument();
    expect(screen.getByText('analytics-db-def456')).toBeInTheDocument();
    const badges = screen.getAllByTestId('status-badge');
    expect(badges.map(b => b.textContent).sort()).toEqual([
      'active',
      'pending',
    ]);
  });

  it('renders the empty-state message when there are no bindings', async () => {
    const client = {
      fetchResourceReleaseBindings: jest
        .fn()
        .mockResolvedValue({ success: true, data: { items: [] } }),
    };

    renderCard(client);

    await waitFor(() => {
      expect(
        screen.getByText('No environment bindings yet.'),
      ).toBeInTheDocument();
    });
  });

  it('renders the error message when the fetch rejects', async () => {
    const client = {
      fetchResourceReleaseBindings: jest
        .fn()
        .mockRejectedValue(new Error('boom')),
    };

    renderCard(client);

    await waitFor(() => {
      expect(
        screen.getByText('Failed to load bindings: boom'),
      ).toBeInTheDocument();
    });
  });

  it('shows the unpinned label when a binding has no resourceRelease', async () => {
    const client = {
      fetchResourceReleaseBindings: jest.fn().mockResolvedValue({
        success: true,
        data: {
          items: [
            {
              name: 'analytics-db-dev',
              environment: 'dev',
              resourceName: 'analytics-db',
              projectName: 'analytics',
              status: 'NotReady',
            },
          ],
        },
      }),
    };

    renderCard(client);

    await waitFor(() => {
      expect(screen.getByText('unpinned')).toBeInTheDocument();
    });
  });
});
