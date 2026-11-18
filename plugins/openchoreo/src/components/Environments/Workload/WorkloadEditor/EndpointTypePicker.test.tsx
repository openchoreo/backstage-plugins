import { fireEvent, render, screen } from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { EndpointTypePicker } from './EndpointTypePicker';

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

function renderPicker(getEntitiesByRefs: jest.Mock, onSelect = jest.fn()) {
  render(
    <TestApiProvider apis={[[catalogApiRef, { getEntitiesByRefs } as any]]}>
      <EndpointTypePicker
        open
        allowedEndpoints={[managed, unmanaged]}
        namespace="acme"
        onSelect={onSelect}
        onClose={jest.fn()}
      />
    </TestApiProvider>,
  );
  return onSelect;
}

describe('EndpointTypePicker', () => {
  it("shows a card per allowed type with the catalog's title and description", async () => {
    const getEntitiesByRefs = jest.fn().mockResolvedValue({
      items: [
        {
          metadata: {
            name: 'unmanaged-http',
            title: 'Unmanaged HTTP',
            description: 'Routes HTTP traffic through the gateway.',
          },
        },
        undefined,
      ],
    });
    renderPicker(getEntitiesByRefs);

    expect(await screen.findByText('Unmanaged HTTP')).toBeInTheDocument();
    expect(
      screen.getByText('Routes HTTP traffic through the gateway.'),
    ).toBeInTheDocument();
    // The default type comes first; cluster and namespaced types are looked
    // up in their own catalog namespaces.
    expect(getEntitiesByRefs).toHaveBeenCalledWith(
      expect.objectContaining({
        entityRefs: [
          'clusterendpointtype:openchoreo-cluster/unmanaged-http',
          'endpointtype:acme/managed-http',
        ],
      }),
    );
    // A type the catalog doesn't have falls back to its name.
    expect(screen.getByText('managed-http')).toBeInTheDocument();
    expect(
      screen.getByText('Exposes the endpoint through managed-http.'),
    ).toBeInTheDocument();
    expect(screen.getByText('GraphQL')).toBeInTheDocument();
    expect(screen.getByText('Default')).toBeInTheDocument();
    expect(screen.getByText('managed')).toBeInTheDocument();
  });

  it('reports the picked type, or project only', async () => {
    const onSelect = renderPicker(
      jest.fn().mockResolvedValue({ items: [undefined, undefined] }),
    );

    fireEvent.click(
      await screen.findByRole('button', { name: /^managed-http/ }),
    );
    expect(onSelect).toHaveBeenCalledWith('EndpointType/managed-http');

    fireEvent.click(screen.getByRole('button', { name: /Project only/ }));
    expect(onSelect).toHaveBeenCalledWith('none');
  });

  it("still offers every type when the catalog can't be read", async () => {
    renderPicker(jest.fn().mockRejectedValue(new Error('down')));

    expect(await screen.findByText('unmanaged-http')).toBeInTheDocument();
    expect(screen.getByText('managed-http')).toBeInTheDocument();
  });

  it('shows nothing while closed, and Cancel closes it', async () => {
    const onClose = jest.fn();
    const getEntitiesByRefs = jest.fn().mockResolvedValue({ items: [] });
    const { rerender } = render(
      <TestApiProvider apis={[[catalogApiRef, { getEntitiesByRefs } as any]]}>
        <EndpointTypePicker
          open={false}
          allowedEndpoints={[unmanaged]}
          namespace="acme"
          onSelect={jest.fn()}
          onClose={onClose}
        />
      </TestApiProvider>,
    );
    expect(screen.queryByRole('region')).toBeNull();
    expect(getEntitiesByRefs).not.toHaveBeenCalled();

    rerender(
      <TestApiProvider apis={[[catalogApiRef, { getEntitiesByRefs } as any]]}>
        <EndpointTypePicker
          open
          allowedEndpoints={[unmanaged]}
          namespace="acme"
          onSelect={jest.fn()}
          onClose={onClose}
        />
      </TestApiProvider>,
    );
    expect(
      await screen.findByRole('region', { name: 'Add an endpoint' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });
});
