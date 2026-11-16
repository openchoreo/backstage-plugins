import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import type { ReactNode } from 'react';
import { openChoreoClientApiRef } from '../../../../api/OpenChoreoClientApi';
import {
  EndpointExposure,
  chosenEndpointTypeKeys,
  useEndpointTypeSchemas,
} from './EndpointExposure';

const httpRoute = {
  protocols: ['HTTP'],
  ref: { kind: 'ClusterEndpointType', name: 'http-route' },
  default: true,
};
const managed = {
  name: 'managed',
  protocols: ['HTTP'],
  ref: { kind: 'ClusterEndpointType', name: 'managed-api' },
};
const grpcOptIn = {
  protocols: ['gRPC'],
  ref: { kind: 'ClusterEndpointType', name: 'grpc-route' },
};

const HTTP_ROUTE = 'ClusterEndpointType/http-route';
const HTTP_ROUTE_SCHEMA = {
  type: 'object' as const,
  properties: {
    pathPrefix: { type: 'string' as const, default: '/', title: 'Path prefix' },
  },
};

describe('EndpointExposure', () => {
  it('renders nothing for an endpoint with project visibility only', () => {
    const { container } = render(
      <EndpointExposure
        endpoint={{ protocol: 'HTTP', visibility: ['project'] }}
        allowedEndpoints={[httpRoute]}
        schemas={{}}
        onChange={jest.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('preselects the default type and shows its parameters', () => {
    render(
      <EndpointExposure
        endpoint={{ protocol: 'HTTP', visibility: ['external'] }}
        allowedEndpoints={[httpRoute, managed]}
        schemas={{ [HTTP_ROUTE]: HTTP_ROUTE_SCHEMA }}
        onChange={jest.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: /http-route/ }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Path prefix/)).toBeInTheDocument();
  });

  it('reports a different type, resetting its parameters', async () => {
    const onChange = jest.fn();
    render(
      <EndpointExposure
        endpoint={{ protocol: 'HTTP', visibility: ['external'] }}
        allowedEndpoints={[httpRoute, managed]}
        schemas={{ [HTTP_ROUTE]: HTTP_ROUTE_SCHEMA }}
        onChange={onChange}
      />,
    );
    fireEvent.mouseDown(screen.getByRole('button', { name: /http-route/ }));
    fireEvent.click(await screen.findByText(/managed-api/));
    expect(onChange).toHaveBeenCalledWith({
      type: 'ClusterEndpointType/managed-api',
    });
  });

  it('fixes the type of a row already exposed through an Endpoint', () => {
    render(
      <EndpointExposure
        endpoint={{ protocol: 'HTTP', visibility: ['external'] }}
        allowedEndpoints={[httpRoute, managed]}
        choice={{ type: HTTP_ROUTE }}
        schemas={{ [HTTP_ROUTE]: HTTP_ROUTE_SCHEMA }}
        onChange={jest.fn()}
        typeLocked
      />,
    );
    expect(screen.getByRole('button', { name: /http-route/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByText(/fixed once created/)).toBeInTheDocument();
  });

  it('starts on the first allowed type when the protocol has no default', () => {
    render(
      <EndpointExposure
        endpoint={{ protocol: 'gRPC', visibility: ['external'] }}
        allowedEndpoints={[httpRoute, grpcOptIn]}
        schemas={{}}
        onChange={jest.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: /grpc-route/ }),
    ).toBeInTheDocument();
  });

  it('offers no "none" option and no default suffix', async () => {
    render(
      <EndpointExposure
        endpoint={{ protocol: 'HTTP', visibility: ['external'] }}
        allowedEndpoints={[httpRoute, managed]}
        schemas={{ [HTTP_ROUTE]: HTTP_ROUTE_SCHEMA }}
        onChange={jest.fn()}
      />,
    );
    fireEvent.mouseDown(screen.getByRole('button', { name: /http-route/ }));
    const options = await screen.findAllByRole('option');
    expect(options.map(o => o.textContent)).toEqual([
      'http-route',
      'managed-api (managed)',
    ]);
  });

  it('preselects the default type for a row loaded with a "none" choice', () => {
    render(
      <EndpointExposure
        endpoint={{ type: 'HTTP', visibility: ['external'] }}
        allowedEndpoints={[httpRoute]}
        choice={{ type: 'none' }}
        schemas={{}}
        onChange={jest.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: /http-route/ }),
    ).toBeInTheDocument();
  });

  it('notes that visibility stays on the workload when no type fits the protocol', () => {
    render(
      <EndpointExposure
        endpoint={{ protocol: 'TCP', visibility: ['external'] }}
        allowedEndpoints={[httpRoute]}
        schemas={{}}
        onChange={jest.fn()}
      />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(
      screen.getByText(/No endpoint type is allowed for TCP/),
    ).toBeInTheDocument();
  });
});

describe('chosenEndpointTypeKeys', () => {
  it('lists the resolved type of every exposable row', () => {
    expect(
      chosenEndpointTypeKeys(
        {
          api: { protocol: 'HTTP', visibility: ['external'] },
          rpc: { protocol: 'gRPC', visibility: ['internal'] },
          admin: { protocol: 'HTTP', visibility: ['project'] },
          raw: { protocol: 'TCP', visibility: ['external'] },
        },
        [httpRoute, managed, grpcOptIn],
        { api: { type: 'ClusterEndpointType/managed-api' } },
      ),
    ).toEqual([
      'ClusterEndpointType/grpc-route',
      'ClusterEndpointType/managed-api',
    ]);
  });
});

describe('useEndpointTypeSchemas', () => {
  it('loads each endpoint type schema once', async () => {
    const client = {
      fetchEndpointTypeParametersSchema: jest
        .fn()
        .mockResolvedValue({ success: true, data: HTTP_ROUTE_SCHEMA }),
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <TestApiProvider apis={[[openChoreoClientApiRef, client as any]]}>
        {children}
      </TestApiProvider>
    );

    const { result, rerender } = renderHook(
      ({ keys }) => useEndpointTypeSchemas(keys, 'acme'),
      { wrapper, initialProps: { keys: [HTTP_ROUTE] } },
    );
    await waitFor(() =>
      expect(result.current[HTTP_ROUTE]).toEqual(HTTP_ROUTE_SCHEMA),
    );
    rerender({ keys: [HTTP_ROUTE] });

    expect(client.fetchEndpointTypeParametersSchema).toHaveBeenCalledTimes(1);
    expect(client.fetchEndpointTypeParametersSchema).toHaveBeenCalledWith(
      'ClusterEndpointType',
      'http-route',
      'acme',
    );
  });
});
