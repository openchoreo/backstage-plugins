import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import type { ReactNode } from 'react';
import { openChoreoClientApiRef } from '../../../../api/OpenChoreoClientApi';
import {
  EndpointTypeParameters,
  chosenEndpointTypeKeys,
  endpointTypeLabel,
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

describe('EndpointTypeParameters', () => {
  it("shows the type's parameters and reports changes", () => {
    const onChange = jest.fn();
    render(
      <EndpointTypeParameters
        typeKey={HTTP_ROUTE}
        parameters={{ pathPrefix: '/orders' }}
        schemas={{ [HTTP_ROUTE]: HTTP_ROUTE_SCHEMA }}
        onChange={onChange}
      />,
    );

    const field = screen.getByLabelText(/Path prefix/);
    expect(field).toHaveValue('/orders');
    fireEvent.change(field, { target: { value: '/v2' } });
    expect(onChange).toHaveBeenLastCalledWith({ pathPrefix: '/v2' });
  });

  it('shows nothing for a type without parameters', () => {
    const { container } = render(
      <EndpointTypeParameters
        typeKey={HTTP_ROUTE}
        parameters={{}}
        schemas={{ [HTTP_ROUTE]: { type: 'object' } }}
        onChange={jest.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("says the defaults are used when the schema can't be loaded", () => {
    render(
      <EndpointTypeParameters
        typeKey={HTTP_ROUTE}
        parameters={{}}
        schemas={{ [HTTP_ROUTE]: 'error' }}
        onChange={jest.fn()}
      />,
    );
    expect(
      screen.getByText(/Could not load the parameters of http-route/),
    ).toBeInTheDocument();
  });
});

describe('endpointTypeLabel', () => {
  it("names a type with its entry's name, if any", () => {
    expect(endpointTypeLabel(HTTP_ROUTE, [httpRoute, managed])).toBe(
      'http-route',
    );
    expect(
      endpointTypeLabel('ClusterEndpointType/managed-api', [
        httpRoute,
        managed,
      ]),
    ).toBe('managed-api (managed)');
  });

  it("falls back to the type's name when it isn't allowed", () => {
    expect(endpointTypeLabel('EndpointType/gone', [httpRoute])).toBe('gone');
  });
});

describe('chosenEndpointTypeKeys', () => {
  it('lists the type of every row with an Endpoint', () => {
    expect(
      chosenEndpointTypeKeys(
        {
          api: { protocol: 'HTTP', visibility: ['external'] },
          rpc: { protocol: 'gRPC', visibility: ['project'] },
          // Deprecated visibility without an Endpoint loads no schema.
          admin: { protocol: 'HTTP', visibility: ['external'] },
          raw: { protocol: 'TCP', visibility: ['external'] },
        },
        [httpRoute, managed, grpcOptIn],
        {
          api: { type: 'ClusterEndpointType/managed-api' },
          rpc: { type: 'ClusterEndpointType/grpc-route' },
        },
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
