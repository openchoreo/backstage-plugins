import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EndpointEnvironmentOverridesPage } from './EndpointEnvironmentOverridesPage';

const mockClient = {
  fetchEndpointEnvironmentInfo: jest.fn(),
  fetchEndpointReleaseSchema: jest.fn(),
  updateEndpointReleaseBinding: jest.fn(),
  fetchEndpointTraffic: jest.fn(),
  deployEndpointRelease: jest.fn(),
};

jest.mock('@backstage/core-plugin-api', () => ({
  ...jest.requireActual('@backstage/core-plugin-api'),
  useApi: () => mockClient,
  createApiRef: (def: { id: string }) => ({ id: def?.id ?? 'ref' }),
  discoveryApiRef: { id: 'discovery' },
  fetchApiRef: { id: 'fetch' },
}));

const entity = {
  kind: 'Endpoint',
  metadata: {
    name: 'orders-api',
    annotations: {
      'openchoreo.io/namespace': 'test-ns',
      'openchoreo.io/endpointtype': 'http-route',
    },
  },
};

jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: () => ({ entity }),
}));

jest.mock('@openchoreo/backstage-plugin-react', () => ({
  ...jest.requireActual('@openchoreo/backstage-plugin-react'),
  DetailPageLayout: ({ title, actions, children }: any) => (
    <div>
      <h1>{title}</h1>
      <div>{actions}</div>
      <div>{children}</div>
    </div>
  ),
  ForbiddenState: ({ message }: any) => (
    <div data-testid="forbidden">{message}</div>
  ),
}));

jest.mock('@openchoreo/backstage-design-system', () => ({
  ...jest.requireActual('@openchoreo/backstage-design-system'),
  RjsfForm: ({ onChange }: any) => (
    <button
      data-testid="rjsf-change"
      onClick={() => onChange({ formData: { hostname: 'new.example.com' } })}
    >
      change
    </button>
  ),
}));

const SCHEMA = {
  success: true,
  data: { type: 'object', properties: { hostname: { type: 'string' } } },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.fetchEndpointReleaseSchema.mockResolvedValue(SCHEMA);
  mockClient.updateEndpointReleaseBinding.mockResolvedValue({});
  mockClient.deployEndpointRelease.mockResolvedValue({});
  mockClient.fetchEndpointTraffic.mockResolvedValue({
    backends: [],
    environments: [],
  });
});

describe('EndpointEnvironmentOverridesPage', () => {
  it('saves overrides without re-sending the release pinned at load time', async () => {
    mockClient.fetchEndpointEnvironmentInfo.mockResolvedValue([
      {
        name: 'Staging',
        resourceName: 'staging',
        bindingName: 'orders-api-staging',
        endpointRelease: 'orders-api-r1',
        latestRelease: 'orders-api-r2',
        endpointTypeEnvironmentConfigs: { hostname: 'old.example.com' },
      },
    ]);
    const onSaved = jest.fn();

    render(
      <MemoryRouter>
        <EndpointEnvironmentOverridesPage
          envName="staging"
          onBack={jest.fn()}
          onSaved={onSaved}
        />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByTestId('rjsf-change'));
    fireEvent.click(screen.getByRole('button', { name: /save overrides/i }));

    // Someone may have promoted staging since the page loaded; saving
    // overrides must not move it back to r1.
    await waitFor(() =>
      expect(mockClient.updateEndpointReleaseBinding).toHaveBeenCalledWith(
        entity,
        'staging',
        { endpointTypeEnvironmentConfigs: { hostname: 'new.example.com' } },
      ),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    // Overrides come from the environment info; the schema from the pinned
    // release's snapshot.
    expect(mockClient.fetchEndpointReleaseSchema).toHaveBeenCalledWith(
      'test-ns',
      'orders-api-r1',
    );
  });

  const deployStaging = (onSaved: () => void) => {
    mockClient.fetchEndpointEnvironmentInfo.mockResolvedValue([
      {
        name: 'Staging',
        resourceName: 'staging',
        latestRelease: 'orders-api-r2',
      },
    ]);
    render(
      <MemoryRouter>
        <EndpointEnvironmentOverridesPage
          envName="staging"
          releaseFromUrl="orders-api-r2"
          onBack={jest.fn()}
          onSaved={onSaved}
        />
      </MemoryRouter>,
    );
  };

  it('deploys the release from the URL, then saves the overrides', async () => {
    const onSaved = jest.fn();
    deployStaging(onSaved);

    fireEvent.click(await screen.findByTestId('rjsf-change'));
    fireEvent.click(screen.getByRole('button', { name: /^deploy$/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mockClient.deployEndpointRelease).toHaveBeenCalledWith(
      entity,
      'staging',
      'orders-api-r2',
    );
    expect(mockClient.updateEndpointReleaseBinding).toHaveBeenCalledWith(
      entity,
      'staging',
      {
        endpointRelease: 'orders-api-r2',
        endpointTypeEnvironmentConfigs: { hostname: 'new.example.com' },
      },
    );
    expect(
      mockClient.deployEndpointRelease.mock.invocationCallOrder[0],
    ).toBeLessThan(
      mockClient.updateEndpointReleaseBinding.mock.invocationCallOrder[0],
    );
  });

  it('writes nothing more and stays open when the deploy fails', async () => {
    mockClient.deployEndpointRelease.mockRejectedValue(new Error('denied'));
    const onSaved = jest.fn();
    deployStaging(onSaved);

    fireEvent.click(await screen.findByTestId('rjsf-change'));
    fireEvent.click(screen.getByRole('button', { name: /^deploy$/i }));

    expect(await screen.findByText(/denied/)).toBeInTheDocument();
    expect(mockClient.updateEndpointReleaseBinding).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
