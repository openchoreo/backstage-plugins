import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import type { Entity } from '@backstage/catalog-model';
import { TestApiProvider } from '@backstage/test-utils';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';
import { ResourceDeploymentsCard } from './ResourceDeploymentsCard';

jest.mock('@backstage/core-components', () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

jest.mock('@openchoreo/backstage-design-system', () => ({
  ...jest.requireActual('@openchoreo/backstage-design-system'),
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
}));

jest.mock('../Environments/OverviewCard/styles', () => ({
  useOverviewCardStyles: () => ({
    card: '',
    cardHeader: '',
    cardTitle: '',
    content: '',
    environmentChips: '',
    envChip: '',
    statusIconReady: '',
    statusIconWarning: '',
    statusIconError: '',
    statusIconDefault: '',
    actions: '',
    disabledState: '',
    disabledIcon: '',
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

function renderCard(client: { fetchResourceEnvironmentInfo: jest.Mock }) {
  return render(
    <MemoryRouter>
      <TestApiProvider apis={[[openChoreoClientApiRef, client as any]]}>
        <EntityProvider entity={makeEntity()}>
          <ResourceDeploymentsCard />
        </EntityProvider>
      </TestApiProvider>
    </MemoryRouter>,
  );
}

describe('ResourceDeploymentsCard', () => {
  it('renders one chip per environment in the pipeline', async () => {
    const client = {
      fetchResourceEnvironmentInfo: jest.fn().mockResolvedValue([
        {
          name: 'development',
          bindingName: 'analytics-db-dev',
          status: 'Ready',
        },
        {
          name: 'staging',
          bindingName: 'analytics-db-stg',
          status: 'NotReady',
        },
        // production has no binding — should still render as "not deployed"
        { name: 'production' },
      ]),
    };

    renderCard(client);

    await waitFor(() => {
      expect(screen.getByText('development')).toBeInTheDocument();
    });
    expect(screen.getByText('staging')).toBeInTheDocument();
    expect(screen.getByText('production')).toBeInTheDocument();
    expect(screen.getByText('Deployments')).toBeInTheDocument();
  });

  it('renders the empty-state when the pipeline has no environments', async () => {
    const client = {
      fetchResourceEnvironmentInfo: jest.fn().mockResolvedValue([]),
    };

    renderCard(client);

    await waitFor(() => {
      expect(
        screen.getByText('No environments configured'),
      ).toBeInTheDocument();
    });
    const cta = screen.getByText('Go to Deploy').closest('a');
    expect(cta).toHaveAttribute('href', 'environments');
  });

  it('renders an error message when the fetch rejects', async () => {
    const client = {
      fetchResourceEnvironmentInfo: jest
        .fn()
        .mockRejectedValue(new Error('boom')),
    };

    renderCard(client);

    await waitFor(() => {
      expect(
        screen.getByText('Failed to load environments: boom'),
      ).toBeInTheDocument();
    });
  });

  it('renders a Go to Deploy CTA alongside the env chips', async () => {
    const client = {
      fetchResourceEnvironmentInfo: jest.fn().mockResolvedValue([
        {
          name: 'development',
          bindingName: 'analytics-db-dev',
          status: 'Ready',
        },
      ]),
    };

    renderCard(client);

    await waitFor(() => {
      expect(screen.getByText('development')).toBeInTheDocument();
    });
    const cta = screen.getByText('Go to Deploy').closest('a');
    expect(cta).toHaveAttribute('href', 'environments');
  });
});
