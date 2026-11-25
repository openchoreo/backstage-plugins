import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TestApiProvider } from '@backstage/test-utils';
import { useApi } from '@backstage/core-plugin-api';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import type { Entity } from '@backstage/catalog-model';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';
import { EndpointArtifactsPage } from './EndpointArtifactsPage';

jest.mock('@openchoreo/backstage-plugin-react', () => ({
  DetailPageLayout: ({ title, subtitle, children }: any) => (
    <div>
      <h1>{title}</h1>
      <h2>{subtitle}</h2>
      {children}
    </div>
  ),
}));

jest.mock('../Environments/hooks', () => ({
  useEnvironmentPolling: () => {},
}));

// The tree has its own tests; this stand-in reads events through the client
// the page provides, as the tree's resource panels do.
jest.mock('../Environments/ReleaseDataRenderer/ResourceTreeView', () => ({
  ResourceTreeView: ({ resourceTreeData, releaseBindingName }: any) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const client = useApi(openChoreoClientApiRef);
    return (
      <div>
        <span>binding {releaseBindingName}</span>
        <span>
          {resourceTreeData.renderedReleases.map((r: any) => r.name).join()}
        </span>
        <button
          onClick={() =>
            client.fetchResourceEvents('acme', releaseBindingName, {
              group: 'gateway.networking.k8s.io',
              version: 'v1',
              kind: 'HTTPRoute',
              name: 'trips',
            })
          }
        >
          events
        </button>
      </div>
    );
  },
}));

const ENTITY: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Endpoint',
  metadata: {
    name: 'trips',
    namespace: 'acme',
    annotations: { 'openchoreo.io/namespace': 'acme' },
  },
  spec: {},
};

function renderPage(client: Record<string, jest.Mock>) {
  return render(
    <MemoryRouter initialEntries={['/artifacts/development']}>
      <TestApiProvider apis={[[openChoreoClientApiRef, client as any]]}>
        <EntityProvider entity={ENTITY}>
          <Routes>
            <Route
              path="/artifacts/:envName"
              element={<EndpointArtifactsPage />}
            />
          </Routes>
        </EntityProvider>
      </TestApiProvider>
    </MemoryRouter>,
  );
}

describe('EndpointArtifactsPage', () => {
  it('shows the tree of the environment’s binding and reads its events', async () => {
    const client = {
      fetchEndpointResourceTree: jest
        .fn()
        .mockResolvedValue({ renderedReleases: [{ name: 'trips-dev-rr' }] }),
      fetchEndpointEnvironmentInfo: jest.fn().mockResolvedValue([
        {
          name: 'Staging',
          resourceName: 'staging',
          bindingName: 'trips-staging',
        },
        {
          name: 'Development',
          resourceName: 'development',
          bindingName: 'trips-development',
        },
      ]),
      fetchEndpointResourceEvents: jest.fn().mockResolvedValue({ events: [] }),
      fetchResourceEvents: jest.fn(),
    };
    renderPage(client);

    expect(
      await screen.findByText('binding trips-development'),
    ).toBeInTheDocument();
    expect(screen.getByText('trips-dev-rr')).toBeInTheDocument();
    expect(client.fetchEndpointResourceTree).toHaveBeenCalledWith(
      'acme',
      'trips-development',
    );
    await waitFor(() =>
      expect(screen.getByText('Development')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'events' }));
    expect(client.fetchEndpointResourceEvents).toHaveBeenCalledWith(
      'acme',
      'trips-development',
      expect.objectContaining({ kind: 'HTTPRoute', name: 'trips' }),
    );
    expect(client.fetchResourceEvents).not.toHaveBeenCalled();
  });

  it('says so when the environment has no binding', async () => {
    renderPage({
      fetchEndpointResourceTree: jest.fn(),
      fetchEndpointEnvironmentInfo: jest.fn().mockResolvedValue([]),
    });

    expect(
      await screen.findByText('No release data available for this environment'),
    ).toBeInTheDocument();
  });
});
