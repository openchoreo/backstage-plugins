import { renderHook, act } from '@testing-library/react';
import { useFileVarEditBuffer } from './useFileVarEditBuffer';
import type { UseFileVarEditBufferOptions } from './useFileVarEditBuffer';

function makeOptions(
  overrides: Partial<UseFileVarEditBufferOptions> = {},
): UseFileVarEditBufferOptions {
  return {
    containers: {},
    onFileVarChange: jest.fn(),
    onRemoveFileVar: jest.fn(),
    ...overrides,
  };
}

describe('useFileVarEditBuffer', () => {
  it('returns correct initial state', () => {
    const { result } = renderHook(() => useFileVarEditBuffer(makeOptions()));

    expect(result.current.editingRow).toBeNull();
    expect(result.current.editBuffer).toBeNull();
    expect(result.current.isAnyRowEditing).toBe(false);
    expect(result.current.isBufferValid).toBe(false);
  });

  it('startEdit reads from containers[name].files[index] and deep-copies', () => {
    const fileVar = {
      key: 'config.yaml',
      mountPath: '/etc/app',
      value: 'data: true',
    };
    const containers = {
      main: { image: 'node:18', files: [fileVar] } as any,
    };
    const { result } = renderHook(() =>
      useFileVarEditBuffer(makeOptions({ containers })),
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
      key: 'config.yaml',
      mountPath: '/etc/app',
      value: 'data: true',
    });
    expect(result.current.editBuffer).not.toBe(fileVar);
    expect(result.current.isAnyRowEditing).toBe(true);
  });

  it('startEdit falls back to empty file var when no file at index', () => {
    const containers = { main: { image: 'node:18' } };
    const { result } = renderHook(() =>
      useFileVarEditBuffer(makeOptions({ containers })),
    );

    act(() => {
      result.current.startEdit('main', 0);
    });

    expect(result.current.editBuffer).toEqual({
      key: '',
      mountPath: '',
      value: '',
    });
  });

  it('startNew creates empty file var with isNew flag', () => {
    const { result } = renderHook(() => useFileVarEditBuffer(makeOptions()));

    act(() => {
      result.current.startNew('main', 0);
    });

    expect(result.current.editingRow).toEqual({
      containerName: 'main',
      index: 0,
      isNew: true,
    });
    expect(result.current.editBuffer).toEqual({
      key: '',
      mountPath: '',
      value: '',
    });
  });

  it('startNew with initialFileVar deep-copies the provided value', () => {
    const initial = { key: 'app.conf', mountPath: '/config', value: 'content' };
    const { result } = renderHook(() => useFileVarEditBuffer(makeOptions()));

    act(() => {
      result.current.startNew('main', 0, initial);
    });

    expect(result.current.editBuffer).toEqual(initial);
    expect(result.current.editBuffer).not.toBe(initial);
  });

  it('applyEdit prefers onFileVarReplace when provided', () => {
    const onFileVarReplace = jest.fn();
    const onFileVarChange = jest.fn();
    const { result } = renderHook(() =>
      useFileVarEditBuffer(makeOptions({ onFileVarReplace, onFileVarChange })),
    );

    act(() => {
      result.current.startNew('main', 0);
    });
    act(() => {
      result.current.setBuffer({
        key: 'f.txt',
        mountPath: '/mnt',
        value: 'hello',
      });
    });
    act(() => {
      result.current.applyEdit();
    });

    expect(onFileVarReplace).toHaveBeenCalledWith(
      'main',
      0,
      expect.objectContaining({ key: 'f.txt', mountPath: '/mnt' }),
    );
    expect(onFileVarChange).not.toHaveBeenCalled();
  });

  it('applyEdit falls back to per-field onFileVarChange when onFileVarReplace is absent', () => {
    const onFileVarChange = jest.fn();
    const { result } = renderHook(() =>
      useFileVarEditBuffer(makeOptions({ onFileVarChange })),
    );

    act(() => {
      result.current.startNew('main', 0);
    });
    act(() => {
      result.current.setBuffer({
        key: 'f.txt',
        mountPath: '/mnt',
        value: 'data',
      });
    });
    act(() => {
      result.current.applyEdit();
    });

    expect(onFileVarChange).toHaveBeenCalledWith('main', 0, 'key', 'f.txt');
    expect(onFileVarChange).toHaveBeenCalledWith(
      'main',
      0,
      'mountPath',
      '/mnt',
    );
    expect(onFileVarChange).toHaveBeenCalledWith('main', 0, 'value', 'data');
    expect(onFileVarChange).toHaveBeenCalledWith(
      'main',
      0,
      'valueFrom',
      undefined,
    );
  });

  it('applyEdit on empty buffer calls onRemoveFileVar', () => {
    const onRemoveFileVar = jest.fn();
    const { result } = renderHook(() =>
      useFileVarEditBuffer(makeOptions({ onRemoveFileVar })),
    );

    act(() => {
      result.current.startNew('main', 0);
    });
    // Buffer is { key: '', mountPath: '', value: '' } which is empty
    act(() => {
      result.current.applyEdit();
    });

    expect(onRemoveFileVar).toHaveBeenCalledWith('main', 0);
    expect(result.current.editingRow).toBeNull();
  });

  it('cancelEdit on new row calls onRemoveFileVar', () => {
    const onRemoveFileVar = jest.fn();
    const { result } = renderHook(() =>
      useFileVarEditBuffer(makeOptions({ onRemoveFileVar })),
    );

    act(() => {
      result.current.startNew('main', 3);
    });
    act(() => {
      result.current.cancelEdit();
    });

    expect(onRemoveFileVar).toHaveBeenCalledWith('main', 3);
    expect(result.current.editingRow).toBeNull();
    expect(result.current.editBuffer).toBeNull();
  });

  it('cancelEdit on existing row clears state without removing', () => {
    const onRemoveFileVar = jest.fn();
    const containers = {
      main: {
        image: 'node:18',
        files: [{ key: 'f.txt', mountPath: '/mnt', value: 'x' }],
      } as any,
    };
    const { result } = renderHook(() =>
      useFileVarEditBuffer(makeOptions({ containers, onRemoveFileVar })),
    );

    act(() => {
      result.current.startEdit('main', 0);
    });
    act(() => {
      result.current.cancelEdit();
    });

    expect(onRemoveFileVar).not.toHaveBeenCalled();
    expect(result.current.editingRow).toBeNull();
  });

  it('isBufferValid requires key, mountPath, and value for plain value', () => {
    const { result } = renderHook(() => useFileVarEditBuffer(makeOptions()));

    act(() => {
      result.current.startNew('main', 0);
    });
    expect(result.current.isBufferValid).toBe(false);

    act(() => {
      result.current.updateBuffer('key', 'file.txt');
    });
    expect(result.current.isBufferValid).toBe(false);

    act(() => {
      result.current.updateBuffer('mountPath', '/data');
    });
    // Still invalid: no value
    expect(result.current.isBufferValid).toBe(false);

    act(() => {
      result.current.updateBuffer('value', 'content');
    });
    expect(result.current.isBufferValid).toBe(true);
  });

  it('isBufferValid for secretKeyRef requires name and key in addition to key and mountPath', () => {
    const { result } = renderHook(() => useFileVarEditBuffer(makeOptions()));

    act(() => {
      result.current.startNew('main', 0);
    });
    act(() => {
      result.current.updateBuffer('key', 'cert.pem');
      result.current.updateBuffer('mountPath', '/certs');
      result.current.updateBuffer('valueFrom', {
        secretKeyRef: { name: '', key: '' },
      });
    });
    expect(result.current.isBufferValid).toBe(false);

    act(() => {
      result.current.updateBuffer('valueFrom', {
        secretKeyRef: { name: 'tls-secret', key: 'cert' },
      });
    });
    expect(result.current.isBufferValid).toBe(true);
  });

  it('clearEditState clears without calling any callbacks', () => {
    const onRemoveFileVar = jest.fn();
    const { result } = renderHook(() =>
      useFileVarEditBuffer(makeOptions({ onRemoveFileVar })),
    );

    act(() => {
      result.current.startNew('main', 0);
    });
    act(() => {
      result.current.clearEditState();
    });

    expect(onRemoveFileVar).not.toHaveBeenCalled();
    expect(result.current.editingRow).toBeNull();
    expect(result.current.editBuffer).toBeNull();
  });
});
