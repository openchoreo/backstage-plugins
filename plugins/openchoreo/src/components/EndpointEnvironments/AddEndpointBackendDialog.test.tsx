import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import type { Entity } from '@backstage/catalog-model';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';
import { AddEndpointBackendDialog } from './AddEndpointBackendDialog';

jest.mock(
  '../../scaffolder/EndpointBackendsField/useProjectWorkloadEndpoints',
  () => ({
    useProjectWorkloadEndpoints: (namespace?: string) => ({
      loading: false,
      components: [],
      options: namespace
        ? [
            { component: 'orders', endpoint: 'api' },
            { component: 'orders', endpoint: 'admin' },
            { component: 'orders', releaseLine: 'next', endpoint: 'api' },
            { component: 'payments', endpoint: 'http' },
          ]
        : [],
    }),
  }),
);

function makeEntity(
  ownerComponent?: string,
  ownerReleaseLine?: string,
): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Endpoint',
    metadata: {
      name: 'orders-api',
      namespace: 'acme',
      annotations: {
        'openchoreo.io/project': 'store',
        ...(ownerComponent && {
          'openchoreo.io/endpoint-owner-component': ownerComponent,
        }),
        ...(ownerReleaseLine && {
          'openchoreo.io/endpoint-owner-release-line': ownerReleaseLine,
        }),
      },
    },
    spec: {},
  };
}

function renderDialog(entity: Entity = makeEntity()) {
  const client = {
    addEndpointBackend: jest
      .fn()
      .mockResolvedValue({ name: 'orders-api', backendName: 'payments-http' }),
  };
  const handlers = { onClose: jest.fn(), onAdded: jest.fn() };
  render(
    <TestApiProvider apis={[[openChoreoClientApiRef, client as any]]}>
      <AddEndpointBackendDialog
        open
        entity={entity}
        backends={[
          { name: 'orders-api', component: 'orders', endpoint: 'api' },
        ]}
        {...handlers}
      />
    </TestApiProvider>,
  );
  return { client, entity, ...handlers };
}

async function pick(name: string) {
  fireEvent.mouseDown(
    screen.getByRole('button', { name: /Workload endpoint/ }),
  );
  fireEvent.click(await screen.findByRole('option', { name }));
}

describe('AddEndpointBackendDialog', () => {
  it("offers the project's workload endpoints the Endpoint doesn't route to yet", async () => {
    renderDialog();

    fireEvent.mouseDown(
      screen.getByRole('button', { name: /Workload endpoint/ }),
    );
    const options = await screen.findAllByRole('option');
    // The main line's orders / api is taken; its release line's isn't.
    expect(options.map(o => o.textContent)).toEqual([
      'orders / admin',
      'orders @ next / api',
      'payments / http',
    ]);
  });

  it("adds a backend on a component's release line", async () => {
    const { client, entity, onAdded } = renderDialog();

    await pick('orders @ next / api');
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    expect(client.addEndpointBackend).toHaveBeenCalledWith(entity, {
      component: 'orders',
      workloadEndpoint: 'api',
      releaseLine: 'next',
      weight: 1,
    });
  });

  it('adds the chosen backend with its weight', async () => {
    const { client, entity, onAdded, onClose } = renderDialog();

    await pick('payments / http');
    fireEvent.change(screen.getByLabelText('Weight'), {
      target: { value: '3' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    expect(client.addEndpointBackend).toHaveBeenCalledWith(entity, {
      component: 'payments',
      workloadEndpoint: 'http',
      weight: 3,
    });
    expect(onAdded).toHaveBeenCalledWith({
      kind: 'add',
      backendName: 'payments-http',
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('rejects a weight outside 0 to 1,000,000', async () => {
    renderDialog();

    await pick('payments / http');
    fireEvent.change(screen.getByLabelText('Weight'), {
      target: { value: '1000001' },
    });

    expect(
      screen.getByText('A whole number from 0 to 1,000,000'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('warns as soon as it opens that a component owns the Endpoint', async () => {
    const { client, onAdded } = renderDialog(makeEntity('orders'));

    // Shown before any backend is picked.
    expect(
      screen.getByText(
        'Component orders owns orders-api endpoint. Adding a backend on another component moves it to project store, so deleting orders no longer deletes it.',
      ),
    ).toBeVisible();

    await pick('payments / http');
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    expect(client.addEndpointBackend).toHaveBeenCalled();
  });

  it('warns that a release line owns the Endpoint', () => {
    renderDialog(makeEntity('orders', 'next'));

    expect(
      screen.getByText(
        'Release line next of component orders owns orders-api endpoint. Adding a backend on another line of orders moves it to the component, and one on another component moves it to project store, so deleting next no longer deletes it.',
      ),
    ).toBeVisible();
  });

  it("doesn't warn for an Endpoint the project owns", () => {
    renderDialog();
    expect(screen.queryByText(/moves it to project/)).not.toBeInTheDocument();
  });

  it('keeps the dialog open with the error when adding fails', async () => {
    const { client, onClose } = renderDialog();
    client.addEndpointBackend.mockRejectedValue(new Error('forbidden'));

    await pick('payments / http');
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('forbidden')).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });
});
