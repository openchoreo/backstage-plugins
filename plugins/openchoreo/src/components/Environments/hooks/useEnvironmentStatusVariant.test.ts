import { renderHook } from '@testing-library/react';
import { useEnvironmentStatusVariant } from './useEnvironmentStatusVariant';

describe('useEnvironmentStatusVariant', () => {
  it('maps ResourcesUndeployed to undeployed', () => {
    const { result } = renderHook(() =>
      useEnvironmentStatusVariant('Ready', 'ResourcesUndeployed'),
    );
    expect(result.current).toEqual({
      variant: 'undeployed',
      label: 'Undeployed',
    });
  });

  it('maps a Ready binding with ReadyWithSuspendedResources to suspended', () => {
    const { result } = renderHook(() =>
      useEnvironmentStatusVariant('Ready', 'ReadyWithSuspendedResources'),
    );
    expect(result.current).toEqual({
      variant: 'suspended',
      label: 'Suspended',
    });
  });

  it('maps Ready (without undeployed reason) to active', () => {
    const { result } = renderHook(() =>
      useEnvironmentStatusVariant('Ready', undefined),
    );
    expect(result.current.variant).toBe('active');
  });

  it('maps NotReady to pending', () => {
    const { result } = renderHook(() =>
      useEnvironmentStatusVariant('NotReady'),
    );
    expect(result.current.variant).toBe('pending');
  });

  it('maps Failed to failed', () => {
    const { result } = renderHook(() => useEnvironmentStatusVariant('Failed'));
    expect(result.current.variant).toBe('failed');
  });

  it('falls back to not-deployed when status is unset', () => {
    const { result } = renderHook(() => useEnvironmentStatusVariant());
    expect(result.current.variant).toBe('not-deployed');
  });
});
