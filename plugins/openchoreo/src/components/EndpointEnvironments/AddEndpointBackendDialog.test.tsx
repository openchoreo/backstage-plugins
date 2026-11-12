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
            { component: 'payments', endpoint: 'http' },
          ]
        : [],
    }),
  }),
);

function makeEntity(ownerComponent?: string): Entity {
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
    expect(options.map(o => o.textContent)).toEqual([
      'orders / admin',
      'payments / http',
    ]);
  });

  it('adds the chosen backend with its weight', async () => {
    const { client, entity, onAdded, onClose } = renderDialog();

    await pick('payments / http');
    fireEvent.change(screen.getByLabelText('Weight'), {
      target: { value: '3' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add backend' }));

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
    expect(screen.getByRole('button', { name: 'Add backend' })).toBeDisabled();
  });

  it('warns before moving a component-owned Endpoint to its project', async () => {
    const { client, onAdded } = renderDialog(makeEntity('orders'));

    // A backend on the owning component keeps the owner.
    await pick('orders / admin');
    expect(screen.queryByText(/moves it to project store/)).toBeNull();

    await pick('payments / http');
    expect(screen.getByText(/moves it to project store/)).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: 'Add and move to project' }),
    );

    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    expect(client.addEndpointBackend).toHaveBeenCalled();
  });

  it('keeps the dialog open with the error when adding fails', async () => {
    const { client, onClose } = renderDialog();
    client.addEndpointBackend.mockRejectedValue(new Error('forbidden'));

    await pick('payments / http');
    fireEvent.click(screen.getByRole('button', { name: 'Add backend' }));

    expect(await screen.findByText('forbidden')).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });
});
