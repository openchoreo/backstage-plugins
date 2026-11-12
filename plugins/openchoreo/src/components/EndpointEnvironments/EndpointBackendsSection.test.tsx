import { act, fireEvent, render, screen } from '@testing-library/react';
import type { Entity } from '@backstage/catalog-model';
import { EndpointBackendsSection } from './EndpointBackendsSection';

let mockEntity: Entity;
const mockRefresh = jest.fn();
jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: () => ({ entity: mockEntity }),
  useAsyncEntity: () => ({ refresh: mockRefresh }),
  EntityRefLink: ({ entityRef }: any) => <span>{entityRef.name}</span>,
}));

let mockCanUpdate = true;
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useResourceDefinitionPermission: () => ({
    canUpdate: mockCanUpdate,
    loading: false,
    updateDeniedTooltip: mockCanUpdate
      ? ''
      : 'You do not have permission to update this endpoint',
  }),
}));

jest.mock('./AddEndpointBackendDialog', () => ({
  AddEndpointBackendDialog: ({ open, onAdded }: any) =>
    open ? (
      <div role="dialog">
        add backend
        <button type="button" onClick={() => onAdded('Backend added.')}>
          confirm add
        </button>
      </div>
    ) : null,
}));

jest.mock('./EndpointBackendDialogs', () => ({
  backendLabel: (b: any) => `${b.component} / ${b.endpoint}`,
  EditBackendWeightDialog: ({ backend }: any) =>
    backend ? <div role="dialog">edit weight of {backend.name}</div> : null,
  RemoveBackendDialog: ({ backend }: any) =>
    backend ? <div role="dialog">remove {backend.name}</div> : null,
}));

const primary = {
  name: 'primary',
  component: 'orders',
  endpoint: 'http',
  weight: 90,
};
const canary = {
  name: 'canary',
  component: 'orders-v2',
  endpoint: 'http',
  weight: 10,
};

function endpointEntity(backends: unknown[]): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Endpoint',
    metadata: { name: 'orders-api', namespace: 'acme' },
    spec: { backends },
  } as Entity;
}

describe('EndpointBackendsSection', () => {
  beforeEach(() => {
    mockCanUpdate = true;
    mockRefresh.mockClear();
  });

  it('lists the backends with their traffic shares', () => {
    mockEntity = endpointEntity([primary, canary]);
    render(<EndpointBackendsSection onChanged={jest.fn()} />);

    expect(screen.getByText('Backends (2)')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByText('10%')).toBeInTheDocument();
  });

  it('opens the weight and remove dialogs for a backend', () => {
    mockEntity = endpointEntity([primary, canary]);
    render(<EndpointBackendsSection onChanged={jest.fn()} />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Edit weight of orders-v2 / http' }),
    );
    expect(screen.getByText('edit weight of canary')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Remove orders-v2 / http' }),
    );
    expect(screen.getByText('remove canary')).toBeInTheDocument();
  });

  it("doesn't remove the last backend", () => {
    mockEntity = endpointEntity([primary]);
    render(<EndpointBackendsSection onChanged={jest.fn()} />);

    expect(
      screen.getByRole('button', { name: 'Remove orders / http' }),
    ).toBeDisabled();
  });

  it('stops adding at 16 backends', () => {
    mockEntity = endpointEntity(
      Array.from({ length: 16 }, (_, i) => ({ ...primary, name: `b${i}` })),
    );
    render(<EndpointBackendsSection onChanged={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Add backend' })).toBeDisabled();
  });

  it('disables changes without permission to update the Endpoint', () => {
    mockCanUpdate = false;
    mockEntity = endpointEntity([primary, canary]);
    render(<EndpointBackendsSection onChanged={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Add backend' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Edit weight of orders / http' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Remove orders / http' }),
    ).toBeDisabled();
  });

  it('looks for the new release once a change is saved', () => {
    jest.useFakeTimers();
    try {
      mockEntity = endpointEntity([primary]);
      const onChanged = jest.fn();
      render(<EndpointBackendsSection onChanged={onChanged} />);

      fireEvent.click(screen.getByRole('button', { name: 'Add backend' }));
      fireEvent.click(screen.getByRole('button', { name: 'confirm add' }));

      expect(onChanged).toHaveBeenCalledTimes(1);
      expect(
        screen.getByText(
          'Backend added. A new release is cut in a few seconds.',
        ),
      ).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(8000);
      });
      expect(mockRefresh).toHaveBeenCalledTimes(2);
      expect(onChanged).toHaveBeenCalledTimes(3);
    } finally {
      jest.useRealTimers();
    }
  });
});
