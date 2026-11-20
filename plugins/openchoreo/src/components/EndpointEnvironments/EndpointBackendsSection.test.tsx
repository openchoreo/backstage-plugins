import { fireEvent, render, screen } from '@testing-library/react';
import type { Entity } from '@backstage/catalog-model';
import type {
  EndpointTrafficBackend,
  EndpointTrafficInfo,
} from '@openchoreo/backstage-plugin-common';
import { EndpointBackendsSection } from './EndpointBackendsSection';
import { EndpointTrafficProvider } from './traffic/useEndpointTraffic';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Endpoint',
  metadata: { name: 'orders-api', namespace: 'acme' },
  spec: {},
} as Entity;
jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: () => ({ entity }),
  useAsyncEntity: () => ({ refresh: jest.fn() }),
  EntityRefLink: ({ entityRef }: any) => <span>{entityRef.name}</span>,
}));

const mockPermission = {
  canUpdate: true,
  loading: false,
  updateDeniedTooltip: 'You do not have permission to change this Endpoint',
};
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  ...jest.requireActual('@openchoreo/backstage-plugin-react'),
  useResourceDefinitionPermission: () => mockPermission,
}));

jest.mock('./traffic/RemoveBackendDialog', () => ({
  ...jest.requireActual('./traffic/RemoveBackendDialog'),
  RemoveBackendDialog: ({ backend }: any) =>
    backend ? <div role="dialog">remove {backend.name}</div> : null,
}));

const backend = (
  name: string,
  weight: number,
  extra: Partial<EndpointTrafficBackend> = {},
): EndpointTrafficBackend => ({
  name,
  componentName: name,
  endpoint: 'http',
  weight,
  ...extra,
});

function renderSection(backends: EndpointTrafficBackend[], awaiting = false) {
  const info: EndpointTrafficInfo = { backends, environments: [] };
  return render(
    <EndpointTrafficProvider
      value={{ info, loading: false, error: null, refetch: jest.fn() }}
    >
      <EndpointBackendsSection awaiting={awaiting} onChanged={jest.fn()} />
    </EndpointTrafficProvider>,
  );
}

describe('EndpointBackendsSection', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockPermission.canUpdate = true;
  });

  it('disables changes while the last change’s release is cut', () => {
    renderSection([backend('trips', 100), backend('trips-go', 0)], true);
    expect(screen.getByRole('button', { name: 'Add backend' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Edit trips' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Remove trips-go' }),
    ).toBeDisabled();
  });

  it('disables changes without permission to update the Endpoint', () => {
    mockPermission.canUpdate = false;
    renderSection([backend('trips', 100), backend('trips-go', 0)]);
    expect(screen.getByRole('button', { name: 'Add backend' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Edit trips' })).toBeDisabled();
  });

  it('shows each backend’s share, condition and copy, with no Edit split', () => {
    renderSection([
      backend('primary', 90),
      backend('canary', 10, {
        match: { headers: [{ name: 'x-canary', value: 'true' }] },
      }),
      backend('shadow', 0, { mirror: { percent: 20 } }),
    ]);

    expect(
      screen.getByRole('button', { name: 'Edit the share of primary' }),
    ).toHaveTextContent('90%');
    expect(screen.getByText('+ if header x-canary: true')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Edit the share of shadow' }),
    ).toHaveTextContent('copy 20%');
    expect(
      screen.queryByRole('button', { name: 'Edit split' }),
    ).not.toBeInTheDocument();
  });

  it('opens the backend page on its share field, or on the backend', () => {
    renderSection([backend('primary', 90), backend('canary', 10)]);

    fireEvent.click(
      screen.getByRole('button', { name: 'Edit the share of canary' }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('backend/canary?focus=share');
    fireEvent.click(screen.getByRole('button', { name: 'Edit primary' }));
    expect(mockNavigate).toHaveBeenCalledWith('backend/primary');
    fireEvent.click(screen.getByRole('button', { name: 'Add backend' }));
    expect(mockNavigate).toHaveBeenCalledWith('add-backend');
  });

  it('removes a backend, but keeps the last one with a share', () => {
    renderSection([backend('primary', 100), backend('canary', 0)]);

    expect(
      screen.getByRole('button', { name: 'Remove primary' }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove canary' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('remove canary');
  });

  it('stops adding backends at the CRD maximum', () => {
    renderSection(Array.from({ length: 16 }, (_, i) => backend(`b${i}`, 1)));

    expect(screen.getByRole('button', { name: 'Add backend' })).toBeDisabled();
  });

  it('offers to remove a backend no environment serves', () => {
    const env = (releaseUnknown?: boolean) => ({
      environment: 'development',
      bindingName: 'orders-api-development',
      endpointRelease: 'orders-api-7',
      release: releaseUnknown
        ? []
        : [backend('trips', 0), backend('trips-go', 100)],
      overrides: [],
      ...(releaseUnknown && { releaseUnknown }),
    });
    const show = (releaseUnknown?: boolean) =>
      render(
        <EndpointTrafficProvider
          value={{
            info: {
              backends: [backend('trips', 50), backend('trips-go', 50)],
              environments: [env(releaseUnknown)],
            },
            loading: false,
            error: null,
            refetch: jest.fn(),
          }}
        >
          <EndpointBackendsSection awaiting={false} onChanged={jest.fn()} />
        </EndpointTrafficProvider>,
      );

    const { unmount } = show();
    expect(screen.getByText(/gets no traffic in any environment/)).toBeTruthy();
    unmount();

    show(true);
    expect(screen.queryByText(/gets no traffic in any environment/)).toBeNull();
  });

  it('says when the backends couldn’t be read, with a retry', () => {
    const refetch = jest.fn();
    render(
      <EndpointTrafficProvider
        value={{
          info: null,
          loading: false,
          error: new Error('forbidden'),
          refetch,
        }}
      >
        <EndpointBackendsSection awaiting={false} onChanged={jest.fn()} />
      </EndpointTrafficProvider>,
    );
    expect(screen.queryByText('Loading backends…')).toBeNull();
    expect(
      screen.getByText(/Couldn’t read the backends: forbidden/),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalled();
  });
});
