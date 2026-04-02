import { renderHook, act } from '@testing-library/react';
import { useEnvVarEditBuffer } from './useEnvVarEditBuffer';
import type { UseEnvVarEditBufferOptions } from './useEnvVarEditBuffer';

function makeOptions(
  overrides: Partial<UseEnvVarEditBufferOptions> = {},
): UseEnvVarEditBufferOptions {
  return {
    containers: {},
    onEnvVarChange: jest.fn(),
    onRemoveEnvVar: jest.fn(),
    ...overrides,
  };
}

describe('useEnvVarEditBuffer', () => {
  it('returns correct initial state', () => {
    const { result } = renderHook(() => useEnvVarEditBuffer(makeOptions()));

    expect(result.current.editingRow).toBeNull();
    expect(result.current.editBuffer).toBeNull();
    expect(result.current.isAnyRowEditing).toBe(false);
    expect(result.current.isBufferValid).toBe(false);
  });

  it('startEdit deep-copies env var from containers and sets editingRow', () => {
    const envVar = {
      key: 'DB_HOST',
      value: 'localhost',
    };
    const containers = {
      main: { image: 'node:18', env: [envVar] },
    };
    const { result } = renderHook(() =>
      useEnvVarEditBuffer(makeOptions({ containers })),
    );

    act(() => {
      result.current.startEdit('main', 0);
    });

    expect(result.current.editingRow).toEqual({
      containerName: 'main',
      index: 0,
      isNew: false,
    });
    expect(result.current.editBuffer).toEqual({
      key: 'DB_HOST',
      value: 'localhost',
    });
    // Verify it's a deep copy, not same reference
    expect(result.current.editBuffer).not.toBe(envVar);
    expect(result.current.isAnyRowEditing).toBe(true);
  });

  it('startEdit falls back to empty env var when container has no env at index', () => {
    const containers = { main: { image: 'node:18' } };
    const { result } = renderHook(() =>
      useEnvVarEditBuffer(makeOptions({ containers })),
    );

    act(() => {
      result.current.startEdit('main', 0);
    });

    expect(result.current.editBuffer).toEqual({ key: '', value: '' });
  });

  it('startNew creates empty env var and sets isNew flag', () => {
    const { result } = renderHook(() => useEnvVarEditBuffer(makeOptions()));

    act(() => {
      result.current.startNew('main', 0);
    });

    expect(result.current.editingRow).toEqual({
      containerName: 'main',
      index: 0,
      isNew: true,
    });
    expect(result.current.editBuffer).toEqual({ key: '', value: '' });
  });

  it('startNew with initialEnvVar deep-copies the provided value', () => {
    const initial = { key: 'API_KEY', value: 'secret' };
    const { result } = renderHook(() => useEnvVarEditBuffer(makeOptions()));

    act(() => {
      result.current.startNew('main', 0, initial);
    });

    expect(result.current.editBuffer).toEqual({
      key: 'API_KEY',
      value: 'secret',
    });
    expect(result.current.editBuffer).not.toBe(initial);
  });

  it('applyEdit prefers onEnvVarReplace when provided', () => {
    const onEnvVarReplace = jest.fn();
    const onEnvVarChange = jest.fn();
    const { result } = renderHook(() =>
      useEnvVarEditBuffer(makeOptions({ onEnvVarReplace, onEnvVarChange })),
    );

    act(() => {
      result.current.startNew('main', 0);
    });
    act(() => {
      result.current.updateBuffer('key', 'MY_VAR');
      result.current.updateBuffer('value', 'my_value');
    });
    act(() => {
      result.current.applyEdit();
    });

    expect(onEnvVarReplace).toHaveBeenCalledWith(
      'main',
      0,
      expect.objectContaining({ key: 'MY_VAR' }),
    );
    expect(onEnvVarChange).not.toHaveBeenCalled();
  });

  it('applyEdit falls back to per-field onEnvVarChange when onEnvVarReplace is absent', () => {
    const onEnvVarChange = jest.fn();
    const { result } = renderHook(() =>
      useEnvVarEditBuffer(makeOptions({ onEnvVarChange })),
    );

    act(() => {
      result.current.startNew('main', 0);
    });
    act(() => {
      result.current.updateBuffer('key', 'MY_VAR');
      result.current.updateBuffer('value', 'my_value');
    });
    act(() => {
      result.current.applyEdit();
    });

    expect(onEnvVarChange).toHaveBeenCalledWith('main', 0, 'key', 'MY_VAR');
    expect(onEnvVarChange).toHaveBeenCalledWith('main', 0, 'value', 'my_value');
    expect(onEnvVarChange).toHaveBeenCalledWith(
      'main',
      0,
      'valueFrom',
      undefined,
    );
  });

  it('applyEdit on empty buffer calls onRemoveEnvVar', () => {
    const onRemoveEnvVar = jest.fn();
    const { result } = renderHook(() =>
      useEnvVarEditBuffer(makeOptions({ onRemoveEnvVar })),
    );

    act(() => {
      result.current.startNew('main', 0);
    });
    // Buffer is { key: '', value: '' } which is empty
    act(() => {
      result.current.applyEdit();
    });

    expect(onRemoveEnvVar).toHaveBeenCalledWith('main', 0);
    expect(result.current.editingRow).toBeNull();
    expect(result.current.editBuffer).toBeNull();
  });

  it('cancelEdit on new row calls onRemoveEnvVar', () => {
    const onRemoveEnvVar = jest.fn();
    const { result } = renderHook(() =>
      useEnvVarEditBuffer(makeOptions({ onRemoveEnvVar })),
    );

    act(() => {
      result.current.startNew('main', 2);
    });
    act(() => {
      result.current.cancelEdit();
    });

    expect(onRemoveEnvVar).toHaveBeenCalledWith('main', 2);
    expect(result.current.editingRow).toBeNull();
    expect(result.current.editBuffer).toBeNull();
  });

  it('cancelEdit on existing row clears editing state without removing', () => {
    const onRemoveEnvVar = jest.fn();
    const containers = {
      main: { image: 'node:18', env: [{ key: 'FOO', value: 'bar' }] },
    };
    const { result } = renderHook(() =>
      useEnvVarEditBuffer(makeOptions({ containers, onRemoveEnvVar })),
    );

    act(() => {
      result.current.startEdit('main', 0);
    });
    act(() => {
      result.current.cancelEdit();
    });

    expect(onRemoveEnvVar).not.toHaveBeenCalled();
    expect(result.current.editingRow).toBeNull();
    expect(result.current.editBuffer).toBeNull();
  });

  it('updateBuffer updates the edit buffer field', () => {
    const { result } = renderHook(() => useEnvVarEditBuffer(makeOptions()));

    act(() => {
      result.current.startNew('main', 0);
    });
    act(() => {
      result.current.updateBuffer('key', 'NEW_KEY');
    });

    expect(result.current.editBuffer?.key).toBe('NEW_KEY');
  });

  it('isBufferValid returns true for plain value with key and value', () => {
    const { result } = renderHook(() => useEnvVarEditBuffer(makeOptions()));

    act(() => {
      result.current.startNew('main', 0);
    });
    expect(result.current.isBufferValid).toBe(false);

    act(() => {
      result.current.updateBuffer('key', 'MY_VAR');
    });
    // Still invalid: no value
    expect(result.current.isBufferValid).toBe(false);

    act(() => {
      result.current.updateBuffer('value', 'hello');
    });
    expect(result.current.isBufferValid).toBe(true);
  });

  it('isBufferValid for secretKeyRef requires name and key', () => {
    const { result } = renderHook(() => useEnvVarEditBuffer(makeOptions()));

    act(() => {
      result.current.startNew('main', 0);
    });
    act(() => {
      result.current.updateBuffer('key', 'SECRET_VAR');
      result.current.updateBuffer('valueFrom', {
        secretKeyRef: { name: '', key: '' },
      });
    });
    expect(result.current.isBufferValid).toBe(false);

    act(() => {
      result.current.updateBuffer('valueFrom', {
        secretKeyRef: { name: 'my-secret', key: 'password' },
      });
    });
    expect(result.current.isBufferValid).toBe(true);
  });

  it('isRowEditing returns true only for the matching row', () => {
    const { result } = renderHook(() => useEnvVarEditBuffer(makeOptions()));

    act(() => {
      result.current.startNew('main', 1);
    });

    expect(result.current.isRowEditing('main', 1)).toBe(true);
    expect(result.current.isRowEditing('main', 0)).toBe(false);
    expect(result.current.isRowEditing('sidecar', 1)).toBe(false);
  });

  it('clearEditState clears without calling any callbacks', () => {
    const onRemoveEnvVar = jest.fn();
    const { result } = renderHook(() =>
      useEnvVarEditBuffer(makeOptions({ onRemoveEnvVar })),
    );

    act(() => {
      result.current.startNew('main', 0);
    });
    act(() => {
      result.current.clearEditState();
    });

    expect(onRemoveEnvVar).not.toHaveBeenCalled();
    expect(result.current.editingRow).toBeNull();
    expect(result.current.editBuffer).toBeNull();
  });
});
