import type { ReactNode } from 'react';
import {
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import {
  EndpointTypePicker,
  useEndpointTypeDetails,
} from './EndpointTypePicker';

const unmanaged = {
  protocols: ['HTTP', 'GraphQL'],
  ref: { kind: 'ClusterEndpointType', name: 'unmanaged-http' },
  default: true,
};
const managed = {
  name: 'managed',
  protocols: ['HTTP'],
  ref: { kind: 'EndpointType', name: 'managed-http' },
};

const UNMANAGED = 'ClusterEndpointType/unmanaged-http';
const MANAGED = 'EndpointType/managed-http';

function renderPicker(
  overrides: { open?: boolean; onSelect?: jest.Mock; onClose?: jest.Mock } = {},
) {
  const props = {
    onSelect: overrides.onSelect ?? jest.fn(),
    onClose: overrides.onClose ?? jest.fn(),
  };
  render(
    <EndpointTypePicker
      open={overrides.open ?? true}
      allowedEndpoints={[managed, unmanaged]}
      details={{
        [UNMANAGED]: {
          title: 'Unmanaged HTTP',
          description: 'Routes HTTP traffic through the gateway.',
        },
      }}
      {...props}
    />,
  );
  return props;
}

describe('EndpointTypePicker', () => {
  it('shows a card per allowed type with its title, description and protocols', () => {
    renderPicker();

    expect(screen.getByText('Unmanaged HTTP')).toBeInTheDocument();
    expect(
      screen.getByText('Routes HTTP traffic through the gateway.'),
    ).toBeInTheDocument();
    // A type the catalog doesn't describe falls back to its name.
    expect(screen.getByText('managed-http')).toBeInTheDocument();
    expect(
      screen.getByText('Exposes the endpoint through managed-http.'),
    ).toBeInTheDocument();
    expect(screen.getByText('GraphQL')).toBeInTheDocument();
    expect(screen.getByText('Default')).toBeInTheDocument();
    expect(screen.getByText('managed')).toBeInTheDocument();
  });

  it('reports the picked type', () => {
    const { onSelect } = renderPicker();

    fireEvent.click(screen.getByRole('button', { name: /^managed-http/ }));
    expect(onSelect).toHaveBeenCalledWith(MANAGED);
  });

  it('offers only the allowed Endpoint types', () => {
    renderPicker();

    expect(
      screen.getAllByRole('button').filter(b => b.textContent !== 'Cancel'),
    ).toHaveLength(2);
    expect(screen.queryByText(/Project only/)).toBeNull();
  });

  it('shows nothing while closed, and Cancel closes it', () => {
    renderPicker({ open: false });
    expect(screen.queryByRole('region')).toBeNull();

    const { onClose } = renderPicker();
    expect(
      screen.getByRole('region', { name: 'Add an endpoint' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('useEndpointTypeDetails', () => {
  function renderDetails(getEntitiesByRefs: jest.Mock, enabled = true) {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <TestApiProvider apis={[[catalogApiRef, { getEntitiesByRefs } as any]]}>
        {children}
      </TestApiProvider>
    );
    return renderHook(
      () => useEndpointTypeDetails([UNMANAGED, MANAGED], 'acme', enabled),
      { wrapper },
    );
  }

  it("reads each type's title and description from the catalog", async () => {
    const getEntitiesByRefs = jest.fn().mockResolvedValue({
      items: [
        {
          metadata: {
            name: 'unmanaged-http',
            title: 'Unmanaged HTTP',
            description: 'Routes HTTP traffic.',
          },
        },
        undefined,
      ],
    });
    const { result } = renderDetails(getEntitiesByRefs);

    await waitFor(() =>
      expect(result.current).toEqual({
        [UNMANAGED]: {
          title: 'Unmanaged HTTP',
          description: 'Routes HTTP traffic.',
        },
      }),
    );
    // Cluster and namespaced types live in their own catalog namespaces.
    expect(getEntitiesByRefs).toHaveBeenCalledWith(
      expect.objectContaining({
        entityRefs: [
          'clusterendpointtype:openchoreo-cluster/unmanaged-http',
          'endpointtype:acme/managed-http',
        ],
      }),
    );
  });

  it('reads nothing until enabled', () => {
    const getEntitiesByRefs = jest.fn();
    const { result } = renderDetails(getEntitiesByRefs, false);

    expect(getEntitiesByRefs).not.toHaveBeenCalled();
    expect(result.current).toEqual({});
  });
});
