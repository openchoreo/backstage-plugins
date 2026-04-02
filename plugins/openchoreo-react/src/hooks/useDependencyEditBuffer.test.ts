import { renderHook, act } from '@testing-library/react';
import { useDependencyEditBuffer } from './useDependencyEditBuffer';
import type { UseDependencyEditBufferOptions } from './useDependencyEditBuffer';

function makeOptions(
  overrides: Partial<UseDependencyEditBufferOptions> = {},
): UseDependencyEditBufferOptions {
  return {
    dependencies: [],
    onRemoveDependency: jest.fn(),
    ...overrides,
  };
}

describe('useDependencyEditBuffer', () => {
  it('returns correct initial state', () => {
    const { result } = renderHook(() => useDependencyEditBuffer(makeOptions()));

    expect(result.current.editingRow).toBeNull();
    expect(result.current.editBuffer).toBeNull();
    expect(result.current.isAnyRowEditing).toBe(false);
    expect(result.current.isBufferValid).toBe(false);
  });

  it('startEdit deep-copies dependency and injects defaultProject', () => {
    const dep = {
      component: 'db-service',
      name: 'postgres',
      visibility: 'project' as const,
    };
    const { result } = renderHook(() =>
      useDependencyEditBuffer(
        makeOptions({
          dependencies: [dep],
          defaultProject: 'my-project',
        }),
      ),
    );

    act(() => {
      result.current.startEdit(0);
    });

    expect(result.current.editingRow).toEqual({ index: 0, isNew: false });
    expect(result.current.editBuffer).toEqual({
      component: 'db-service',
      name: 'postgres',
      visibility: 'project',
      project: 'my-project',
    });
    expect(result.current.editBuffer).not.toBe(dep);
  });

  it('startEdit does not override existing project with defaultProject', () => {
    const dep = {
      component: 'svc',
      name: 'ep',
      visibility: 'namespace' as const,
      project: 'other-project',
    };
    const { result } = renderHook(() =>
      useDependencyEditBuffer(
        makeOptions({
          dependencies: [dep],
          defaultProject: 'my-project',
        }),
      ),
    );

    act(() => {
      result.current.startEdit(0);
    });

    expect(result.current.editBuffer?.project).toBe('other-project');
  });

  it('startEdit falls back to empty dependency when index has no data', () => {
    const { result } = renderHook(() =>
      useDependencyEditBuffer(makeOptions({ dependencies: [] })),
    );

    act(() => {
      result.current.startEdit(0);
    });

    expect(result.current.editBuffer).toEqual({
      component: '',
      name: '',
      visibility: 'project',
      envBindings: {},
    });
  });

  it('startNew creates empty dependency with isNew flag and defaultProject', () => {
    const { result } = renderHook(() =>
      useDependencyEditBuffer(makeOptions({ defaultProject: 'proj-alpha' })),
    );

    act(() => {
      result.current.startNew(0);
    });

    expect(result.current.editingRow).toEqual({ index: 0, isNew: true });
    expect(result.current.editBuffer).toEqual({
      component: '',
      name: '',
      visibility: 'project',
      envBindings: {},
      project: 'proj-alpha',
    });
  });

  it('startNew with initialDependency deep-copies and injects defaultProject', () => {
    const initial = {
      component: 'api-gw',
      name: 'http',
      visibility: 'namespace' as const,
    };
    const { result } = renderHook(() =>
      useDependencyEditBuffer(makeOptions({ defaultProject: 'proj-beta' })),
    );

    act(() => {
      result.current.startNew(0, initial);
    });

    expect(result.current.editBuffer).toEqual({
      component: 'api-gw',
      name: 'http',
      visibility: 'namespace',
      project: 'proj-beta',
    });
    expect(result.current.editBuffer).not.toBe(initial);
  });

  it('applyEdit on empty buffer calls onRemoveDependency', () => {
    const onRemoveDependency = jest.fn();
    const { result } = renderHook(() =>
      useDependencyEditBuffer(makeOptions({ onRemoveDependency })),
    );

    act(() => {
      result.current.startNew(0);
    });
    // Buffer has component='' and name='' which is empty
    act(() => {
      result.current.applyEdit();
    });

    expect(onRemoveDependency).toHaveBeenCalledWith(0);
    expect(result.current.editingRow).toBeNull();
  });

  it('applyEdit on invalid (but non-empty) buffer returns early without committing', () => {
    const onDependencyReplace = jest.fn();
    const onRemoveDependency = jest.fn();
    const { result } = renderHook(() =>
      useDependencyEditBuffer(
        makeOptions({ onDependencyReplace, onRemoveDependency }),
      ),
    );

    act(() => {
      result.current.startNew(0);
    });
    act(() => {
      // Has component but no name or visibility -> non-empty but invalid
      result.current.updateBuffer('component', 'my-svc');
    });
    act(() => {
      result.current.applyEdit();
    });

    // Should NOT commit or remove -- stays in editing mode
    expect(onDependencyReplace).not.toHaveBeenCalled();
    expect(onRemoveDependency).not.toHaveBeenCalled();
    expect(result.current.editingRow).not.toBeNull();
    expect(result.current.editBuffer).not.toBeNull();
  });

  it('applyEdit commits valid buffer via onDependencyReplace', () => {
    const onDependencyReplace = jest.fn();
    const { result } = renderHook(() =>
      useDependencyEditBuffer(makeOptions({ onDependencyReplace })),
    );

    act(() => {
      result.current.startNew(0);
    });
    act(() => {
      result.current.updateBuffer('component', 'db-svc');
      result.current.updateBuffer('name', 'main-ep');
      result.current.updateBuffer('visibility', 'project');
    });
    act(() => {
      result.current.applyEdit();
    });

    expect(onDependencyReplace).toHaveBeenCalledWith(
      0,
      expect.objectContaining({
        component: 'db-svc',
        name: 'main-ep',
        visibility: 'project',
      }),
    );
    expect(result.current.editingRow).toBeNull();
  });

  it('cancelEdit on new row calls onRemoveDependency', () => {
    const onRemoveDependency = jest.fn();
    const { result } = renderHook(() =>
      useDependencyEditBuffer(makeOptions({ onRemoveDependency })),
    );

    act(() => {
      result.current.startNew(2);
    });
    act(() => {
      result.current.cancelEdit();
    });

    expect(onRemoveDependency).toHaveBeenCalledWith(2);
    expect(result.current.editingRow).toBeNull();
  });

  it('cancelEdit on existing row clears state without removing', () => {
    const onRemoveDependency = jest.fn();
    const dep = {
      component: 'svc',
      name: 'ep',
      visibility: 'project' as const,
    };
    const { result } = renderHook(() =>
      useDependencyEditBuffer(
        makeOptions({ dependencies: [dep], onRemoveDependency }),
      ),
    );

    act(() => {
      result.current.startEdit(0);
    });
    act(() => {
      result.current.cancelEdit();
    });

    expect(onRemoveDependency).not.toHaveBeenCalled();
    expect(result.current.editingRow).toBeNull();
  });

  it('updateBufferEnvBindings updates nested envBindings field', () => {
    const { result } = renderHook(() => useDependencyEditBuffer(makeOptions()));

    act(() => {
      result.current.startNew(0);
    });
    act(() => {
      result.current.updateBufferEnvBindings('address', 'DB_ADDRESS');
    });

    expect(result.current.editBuffer?.envBindings?.address).toBe('DB_ADDRESS');
  });

  it('isDependencyValid requires component, name, and visibility', () => {
    const { result } = renderHook(() => useDependencyEditBuffer(makeOptions()));

    act(() => {
      result.current.startNew(0);
    });
    expect(result.current.isBufferValid).toBe(false);

    act(() => {
      result.current.updateBuffer('component', 'svc');
    });
    expect(result.current.isBufferValid).toBe(false);

    act(() => {
      result.current.updateBuffer('name', 'endpoint');
    });
    // visibility is 'project' by default from startNew
    expect(result.current.isBufferValid).toBe(true);
  });

  it('clearEditState clears without calling any callbacks', () => {
    const onRemoveDependency = jest.fn();
    const { result } = renderHook(() =>
      useDependencyEditBuffer(makeOptions({ onRemoveDependency })),
    );

    act(() => {
      result.current.startNew(0);
    });
    act(() => {
      result.current.clearEditState();
    });

    expect(onRemoveDependency).not.toHaveBeenCalled();
    expect(result.current.editingRow).toBeNull();
    expect(result.current.editBuffer).toBeNull();
  });
});
