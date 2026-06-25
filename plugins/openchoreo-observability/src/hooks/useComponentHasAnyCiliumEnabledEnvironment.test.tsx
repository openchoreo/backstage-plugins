import { renderHook } from '@testing-library/react';
import { Entity } from '@backstage/catalog-model';
import { useComponentHasAnyCiliumEnabledEnvironment } from './useComponentHasAnyCiliumEnabledEnvironment';

const mockUseGetNamespaceAndProjectByEntity = jest.fn();
const mockUseWirelogsEnvironments = jest.fn();

jest.mock('./useGetNamespaceAndProjectByEntity', () => ({
  useGetNamespaceAndProjectByEntity: (...args: any[]) =>
    mockUseGetNamespaceAndProjectByEntity(...args),
}));
jest.mock('./useWirelogsEnvironments', () => ({
  useWirelogsEnvironments: (...args: any[]) =>
    mockUseWirelogsEnvironments(...args),
}));

const entity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'svc' },
};

const setup = () =>
  renderHook(() => useComponentHasAnyCiliumEnabledEnvironment(entity));

beforeEach(() => {
  jest.clearAllMocks();
  mockUseGetNamespaceAndProjectByEntity.mockReturnValue({
    namespace: 'ns-1',
    project: 'proj-1',
    error: null,
  });
});

describe('useComponentHasAnyCiliumEnabledEnvironment', () => {
  it('returns true when at least one environment runs Cilium', () => {
    mockUseWirelogsEnvironments.mockReturnValue({
      environments: [
        { name: 'dev', hasWirelogs: false },
        { name: 'prod', hasWirelogs: true },
      ],
      loading: false,
      error: null,
    });

    const { result } = setup();
    expect(result.current).toBe(true);
  });

  it('returns false when no environment runs Cilium', () => {
    mockUseWirelogsEnvironments.mockReturnValue({
      environments: [
        { name: 'dev', hasWirelogs: false },
        { name: 'prod', hasWirelogs: false },
      ],
      loading: false,
      error: null,
    });

    const { result } = setup();
    expect(result.current).toBe(false);
  });

  it('returns false while the probe is in flight (no environments yet)', () => {
    mockUseWirelogsEnvironments.mockReturnValue({
      environments: [],
      loading: true,
      error: null,
    });

    const { result } = setup();
    expect(result.current).toBe(false);
  });

  it('derives project + namespace from the entity and forwards them to the probe', () => {
    mockUseWirelogsEnvironments.mockReturnValue({
      environments: [],
      loading: false,
      error: null,
    });

    setup();

    expect(mockUseGetNamespaceAndProjectByEntity).toHaveBeenCalledWith(entity);
    expect(mockUseWirelogsEnvironments).toHaveBeenCalledWith('proj-1', 'ns-1');
  });
});
