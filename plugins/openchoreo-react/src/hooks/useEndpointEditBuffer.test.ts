import { renderHook, act } from '@testing-library/react';
import { useEndpointEditBuffer } from './useEndpointEditBuffer';
import type { UseEndpointEditBufferOptions } from './useEndpointEditBuffer';

function makeOptions(
  overrides: Partial<UseEndpointEditBufferOptions> = {},
): UseEndpointEditBufferOptions {
  return {
    endpoints: {},
    onRemoveEndpoint: jest.fn(),
    ...overrides,
  };
}

describe('useEndpointEditBuffer', () => {
  it('returns correct initial state', () => {
    const { result } = renderHook(() => useEndpointEditBuffer(makeOptions()));

    expect(result.current.editingRow).toBeNull();
    expect(result.current.editBuffer).toBeNull();
    expect(result.current.editBufferName).toBeNull();
    expect(result.current.isAnyRowEditing).toBe(false);
    expect(result.current.isBufferValid).toBe(false);
  });

  it('startEdit deep-copies endpoint from endpoints map and sets editBufferName', () => {
    const endpoint = {
      type: 'HTTP' as const,
      port: 3000,
      visibility: ['external' as const],
    };
    const { result } = renderHook(() =>
      useEndpointEditBuffer(makeOptions({ endpoints: { 'my-ep': endpoint } })),
    );

    act(() => {
      result.current.startEdit('my-ep');
    });

    expect(result.current.editingRow).toEqual({
      endpointName: 'my-ep',
      isNew: false,
    });
    expect(result.current.editBuffer).toEqual({
      type: 'HTTP',
      port: 3000,
      visibility: ['external'],
    });
    expect(result.current.editBuffer).not.toBe(endpoint);
    expect(result.current.editBufferName).toBe('my-ep');
  });

  it('startEdit falls back to default values when endpoint not found', () => {
    const { result } = renderHook(() =>
      useEndpointEditBuffer(makeOptions({ endpoints: {} })),
    );

    act(() => {
      result.current.startEdit('missing');
    });

    expect(result.current.editBuffer).toEqual({
      type: 'HTTP',
      port: 8080,
      visibility: ['external'],
    });
    expect(result.current.editBufferName).toBe('missing');
  });

  it('startNew creates endpoint with default values and isNew flag', () => {
    const { result } = renderHook(() => useEndpointEditBuffer(makeOptions()));

    act(() => {
      result.current.startNew('new-ep');
    });

    expect(result.current.editingRow).toEqual({
      endpointName: 'new-ep',
      isNew: true,
    });
    expect(result.current.editBuffer).toEqual({
      type: 'HTTP',
      port: 8080,
      visibility: ['external'],
    });
    expect(result.current.editBufferName).toBe('new-ep');
  });

  it('startNew with initialEndpoint deep-copies the provided value', () => {
    const initial = {
      type: 'gRPC' as const,
      port: 9090,
      schema: { content: 'proto' },
    };
    const { result } = renderHook(() => useEndpointEditBuffer(makeOptions()));

    act(() => {
      result.current.startNew('grpc-ep', initial);
    });

    expect(result.current.editBuffer).toEqual({
      type: 'gRPC',
      port: 9090,
      schema: { content: 'proto' },
    });
    expect(result.current.editBuffer).not.toBe(initial);
  });

  it('applyEdit calls onEndpointReplace with current buffer', () => {
    const onEndpointReplace = jest.fn();
    const { result } = renderHook(() =>
      useEndpointEditBuffer(makeOptions({ onEndpointReplace })),
    );

    act(() => {
      result.current.startNew('api');
    });
    act(() => {
      result.current.updateBuffer('port', 3000);
    });
    act(() => {
      result.current.applyEdit();
    });

    expect(onEndpointReplace).toHaveBeenCalledWith(
      'api',
      expect.objectContaining({ type: 'HTTP', port: 3000 }),
      undefined, // no rename
    );
    expect(result.current.editingRow).toBeNull();
    expect(result.current.editBufferName).toBeNull();
  });

  it('applyEdit detects rename and passes oldNameToRemove for existing endpoints', () => {
    const onEndpointReplace = jest.fn();
    const endpoints = {
      'old-name': { type: 'HTTP' as const, port: 8080 },
    };
    const { result } = renderHook(() =>
      useEndpointEditBuffer(makeOptions({ endpoints, onEndpointReplace })),
    );

    act(() => {
      result.current.startEdit('old-name');
    });
    act(() => {
      result.current.updateBufferName('new-name');
    });
    act(() => {
      result.current.applyEdit();
    });

    expect(onEndpointReplace).toHaveBeenCalledWith(
      'new-name',
      expect.objectContaining({ type: 'HTTP', port: 8080 }),
      'old-name', // old name to remove
    );
  });

  it('applyEdit does NOT set oldNameToRemove for new endpoints even if name changed', () => {
    const onEndpointReplace = jest.fn();
    const { result } = renderHook(() =>
      useEndpointEditBuffer(makeOptions({ onEndpointReplace })),
    );

    act(() => {
      result.current.startNew('temp-name');
    });
    act(() => {
      result.current.updateBufferName('final-name');
    });
    act(() => {
      result.current.applyEdit();
    });

    expect(onEndpointReplace).toHaveBeenCalledWith(
      'final-name',
      expect.any(Object),
      undefined, // no old name to remove for new endpoints
    );
  });

  it('applyEdit on empty buffer calls onRemoveEndpoint', () => {
    const onRemoveEndpoint = jest.fn();
    const { result } = renderHook(() =>
      useEndpointEditBuffer(makeOptions({ onRemoveEndpoint })),
    );

    act(() => {
      result.current.startNew('ep');
    });
    act(() => {
      // Make buffer empty: no type, port <= 0
      result.current.setBuffer({ type: '' as any, port: 0 });
    });
    act(() => {
      result.current.applyEdit();
    });

    expect(onRemoveEndpoint).toHaveBeenCalledWith('ep');
    expect(result.current.editingRow).toBeNull();
  });

  it('cancelEdit on new row calls onRemoveEndpoint', () => {
    const onRemoveEndpoint = jest.fn();
    const { result } = renderHook(() =>
      useEndpointEditBuffer(makeOptions({ onRemoveEndpoint })),
    );

    act(() => {
      result.current.startNew('temp-ep');
    });
    act(() => {
      result.current.cancelEdit();
    });

    expect(onRemoveEndpoint).toHaveBeenCalledWith('temp-ep');
    expect(result.current.editingRow).toBeNull();
    expect(result.current.editBufferName).toBeNull();
  });

  it('cancelEdit on existing row clears state without removing', () => {
    const onRemoveEndpoint = jest.fn();
    const endpoints = { api: { type: 'HTTP' as const, port: 8080 } };
    const { result } = renderHook(() =>
      useEndpointEditBuffer(makeOptions({ endpoints, onRemoveEndpoint })),
    );

    act(() => {
      result.current.startEdit('api');
    });
    act(() => {
      result.current.cancelEdit();
    });

    expect(onRemoveEndpoint).not.toHaveBeenCalled();
    expect(result.current.editingRow).toBeNull();
  });

  it('isEndpointValid requires type and port > 0', () => {
    const { result } = renderHook(() => useEndpointEditBuffer(makeOptions()));

    act(() => {
      result.current.startNew('ep');
    });
    // Default: type='HTTP', port=8080 -> valid
    expect(result.current.isBufferValid).toBe(true);

    act(() => {
      result.current.updateBuffer('port', 0);
    });
    expect(result.current.isBufferValid).toBe(false);

    act(() => {
      result.current.updateBuffer('port', 443);
    });
    expect(result.current.isBufferValid).toBe(true);
  });

  it('isEndpointValid for gRPC requires schema.content', () => {
    const { result } = renderHook(() => useEndpointEditBuffer(makeOptions()));

    act(() => {
      result.current.startNew('grpc-ep');
    });
    act(() => {
      result.current.updateBuffer('type', 'gRPC');
    });
    // gRPC without schema -> invalid
    expect(result.current.isBufferValid).toBe(false);

    act(() => {
      result.current.updateBuffer('schema', { content: 'syntax = "proto3";' });
    });
    expect(result.current.isBufferValid).toBe(true);
  });

  it('updateBufferName updates the buffered endpoint name', () => {
    const { result } = renderHook(() => useEndpointEditBuffer(makeOptions()));

    act(() => {
      result.current.startNew('original');
    });
    expect(result.current.editBufferName).toBe('original');

    act(() => {
      result.current.updateBufferName('renamed');
    });
    expect(result.current.editBufferName).toBe('renamed');
  });

  it('clearEditState clears without calling any callbacks', () => {
    const onRemoveEndpoint = jest.fn();
    const { result } = renderHook(() =>
      useEndpointEditBuffer(makeOptions({ onRemoveEndpoint })),
    );

    act(() => {
      result.current.startNew('ep');
    });
    act(() => {
      result.current.clearEditState();
    });

    expect(onRemoveEndpoint).not.toHaveBeenCalled();
    expect(result.current.editingRow).toBeNull();
    expect(result.current.editBuffer).toBeNull();
    expect(result.current.editBufferName).toBeNull();
  });
});
