import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import type { Entity } from '@backstage/catalog-model';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';
import {
  EditBackendWeightDialog,
  RemoveBackendDialog,
} from './EndpointBackendDialogs';

const entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Endpoint',
  metadata: { name: 'orders-api', namespace: 'acme' },
  spec: {},
} as Entity;

const orders = { name: 'orders-api', component: 'orders', endpoint: 'api' };
const payments = {
  name: 'payments-http',
  component: 'payments',
  endpoint: 'http',
  weight: 1,
};

function renderWithClient(ui: JSX.Element, client: Record<string, jest.Mock>) {
  return render(
    <TestApiProvider apis={[[openChoreoClientApiRef, client as any]]}>
      {ui}
    </TestApiProvider>,
  );
}

describe('EditBackendWeightDialog', () => {
  it('saves the new weight', async () => {
    const client = {
      updateEndpointBackendWeight: jest.fn().mockResolvedValue(undefined),
    };
    const onSaved = jest.fn();
    const onClose = jest.fn();
    renderWithClient(
      <EditBackendWeightDialog
        backend={payments}
        backends={[orders, payments]}
        entity={entity}
        onClose={onClose}
        onSaved={onSaved}
      />,
      client,
    );

    const save = screen.getByRole('button', { name: 'Save' });
    // Unchanged weight: nothing to save.
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Weight'), {
      target: { value: '4' },
    });
    fireEvent.click(save);

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(client.updateEndpointBackendWeight).toHaveBeenCalledWith(
      entity,
      'payments-http',
      4,
    );
    expect(onSaved).toHaveBeenCalledWith('Weight of payments / http set to 4.');
  });

  it('refuses a weight that leaves no backend taking traffic', () => {
    renderWithClient(
      <EditBackendWeightDialog
        backend={payments}
        backends={[{ ...orders, weight: 0 }, payments]}
        entity={entity}
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />,
      { updateEndpointBackendWeight: jest.fn() },
    );

    fireEvent.change(screen.getByLabelText('Weight'), {
      target: { value: '0' },
    });

    expect(screen.getByText(/needs a weight above 0/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('refuses a weight that is not a whole number', () => {
    renderWithClient(
      <EditBackendWeightDialog
        backend={payments}
        backends={[orders, payments]}
        entity={entity}
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />,
      { updateEndpointBackendWeight: jest.fn() },
    );

    fireEvent.change(screen.getByLabelText('Weight'), {
      target: { value: '1.5' },
    });

    expect(
      screen.getByText('A whole number from 0 to 1,000,000'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('keeps the dialog open with the error when saving fails', async () => {
    const client = {
      updateEndpointBackendWeight: jest
        .fn()
        .mockRejectedValue(new Error('forbidden')),
    };
    const onClose = jest.fn();
    renderWithClient(
      <EditBackendWeightDialog
        backend={payments}
        backends={[orders, payments]}
        entity={entity}
        onClose={onClose}
        onSaved={jest.fn()}
      />,
      client,
    );

    fireEvent.change(screen.getByLabelText('Weight'), {
      target: { value: '2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('forbidden')).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('RemoveBackendDialog', () => {
  it('removes the backend after confirming', async () => {
    const client = {
      removeEndpointBackend: jest.fn().mockResolvedValue(undefined),
    };
    const onSaved = jest.fn();
    const onClose = jest.fn();
    renderWithClient(
      <RemoveBackendDialog
        backend={payments}
        backends={[orders, payments]}
        entity={entity}
        onClose={onClose}
        onSaved={onSaved}
      />,
      client,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(client.removeEndpointBackend).toHaveBeenCalledWith(
      entity,
      'payments-http',
    );
    expect(onSaved).toHaveBeenCalledWith('Backend payments / http removed.');
  });

  it('refuses to leave only backends with weight 0', () => {
    renderWithClient(
      <RemoveBackendDialog
        backend={payments}
        backends={[{ ...orders, weight: 0 }, payments]}
        entity={entity}
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />,
      { removeEndpointBackend: jest.fn() },
    );

    expect(screen.getByText(/needs a weight above 0/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled();
  });
});
