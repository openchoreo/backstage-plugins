import { renderHook, act } from '@testing-library/react';
import { useContainerForm, UseContainerFormOptions } from './useContainerForm';
import type { Container } from '@openchoreo/backstage-plugin-common';

describe('useContainerForm', () => {
  const makeContainer = (overrides: Partial<Container> = {}): Container => ({
    image: '',
    env: [],
    command: [],
    args: [],
    ...overrides,
  });

  // Stable empty containers reference to avoid infinite re-render loop caused
  // by the hook's default `= {}` destructuring creating new references.
  const EMPTY: Record<string, Container> = {};

  // Helper: renders useContainerForm with stable options via initialProps
  function renderContainerForm(opts: UseContainerFormOptions = {}) {
    const stableOpts = {
      ...opts,
      initialContainers: opts.initialContainers ?? EMPTY,
    };
    return renderHook(
      (props: UseContainerFormOptions) => useContainerForm(props),
      { initialProps: stableOpts },
    );
  }

  describe('initial state', () => {
    it('defaults to empty containers when no initialContainers provided', () => {
      const { result } = renderContainerForm();

      expect(result.current.containers).toEqual({});
    });

    it('uses initialContainers when provided', () => {
      const initial = { main: makeContainer({ image: 'nginx:latest' }) };
      const { result } = renderContainerForm({ initialContainers: initial });

      expect(result.current.containers).toEqual(initial);
    });
  });

  describe('handleAddContainer', () => {
    it('names the first container "main"', () => {
      const { result } = renderContainerForm();

      act(() => {
        result.current.handleAddContainer();
      });

      expect(result.current.containers).toHaveProperty('main');
      expect(result.current.containers.main).toEqual(makeContainer());
    });

    it('names subsequent containers "container-N"', () => {
      const { result } = renderContainerForm();

      act(() => {
        result.current.handleAddContainer();
      });
      act(() => {
        result.current.handleAddContainer();
      });
      act(() => {
        result.current.handleAddContainer();
      });

      expect(Object.keys(result.current.containers)).toEqual([
        'main',
        'container-1',
        'container-2',
      ]);
    });
  });

  describe('handleRemoveContainer', () => {
    it('removes a container by name', () => {
      const initial = {
        main: makeContainer({ image: 'a' }),
        sidecar: makeContainer({ image: 'b' }),
      };
      const { result } = renderContainerForm({ initialContainers: initial });

      act(() => {
        result.current.handleRemoveContainer('main');
      });

      expect(result.current.containers).not.toHaveProperty('main');
      expect(result.current.containers).toHaveProperty('sidecar');
    });
  });

  describe('handleAddEnvVar', () => {
    it('adds an empty env var to the specified container', () => {
      const initial = { main: makeContainer() };
      const { result } = renderContainerForm({ initialContainers: initial });

      act(() => {
        result.current.handleAddEnvVar('main');
      });

      expect(result.current.containers.main.env).toEqual([
        { key: '', value: '' },
      ]);
    });

    it('does nothing if container does not exist', () => {
      const { result } = renderContainerForm();

      act(() => {
        result.current.handleAddEnvVar('nonexistent');
      });

      expect(result.current.containers).toEqual({});
    });
  });

  describe('handleRemoveEnvVar', () => {
    it('removes an env var by index', () => {
      const initial = {
        main: makeContainer({
          env: [
            { key: 'A', value: '1' },
            { key: 'B', value: '2' },
            { key: 'C', value: '3' },
          ],
        }),
      };
      const { result } = renderContainerForm({ initialContainers: initial });

      act(() => {
        result.current.handleRemoveEnvVar('main', 1);
      });

      expect(result.current.containers.main.env).toEqual([
        { key: 'A', value: '1' },
        { key: 'C', value: '3' },
      ]);
    });
  });

  describe('handleAddFileVar', () => {
    it('adds an empty file var to the specified container', () => {
      const initial = { main: makeContainer() };
      const { result } = renderContainerForm({ initialContainers: initial });

      act(() => {
        result.current.handleAddFileVar('main');
      });

      expect((result.current.containers.main as any).files).toEqual([
        { key: '', mountPath: '', value: '' },
      ]);
    });
  });

  describe('handleRemoveFileVar', () => {
    it('removes a file var by index', () => {
      const initial = {
        main: {
          ...makeContainer(),
          files: [
            { key: 'f1', mountPath: '/a', value: 'x' },
            { key: 'f2', mountPath: '/b', value: 'y' },
          ],
        } as Container,
      };
      const { result } = renderContainerForm({ initialContainers: initial });

      act(() => {
        result.current.handleRemoveFileVar('main', 0);
      });

      expect((result.current.containers.main as any).files).toEqual([
        { key: 'f2', mountPath: '/b', value: 'y' },
      ]);
    });
  });

  describe('handleArrayFieldChange', () => {
    it('splits comma-separated values, trims whitespace, and filters empty strings', () => {
      const initial = { main: makeContainer() };
      const { result } = renderContainerForm({ initialContainers: initial });

      act(() => {
        result.current.handleArrayFieldChange(
          'main',
          'command',
          'npm,  run , start, , ',
        );
      });

      expect(result.current.containers.main.command).toEqual([
        'npm',
        'run',
        'start',
      ]);
    });

    it('returns empty array for empty string input', () => {
      const initial = { main: makeContainer() };
      const { result } = renderContainerForm({ initialContainers: initial });

      act(() => {
        result.current.handleArrayFieldChange('main', 'args', '');
      });

      expect(result.current.containers.main.args).toEqual([]);
    });
  });

  describe('onChange callback', () => {
    it('fires on handleAddContainer', () => {
      const onChange = jest.fn();
      const { result } = renderContainerForm({ onChange });

      act(() => {
        result.current.handleAddContainer();
      });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ main: expect.any(Object) }),
      );
    });

    it('fires on handleRemoveContainer', () => {
      const onChange = jest.fn();
      const initial = { main: makeContainer() };
      const { result } = renderContainerForm({
        initialContainers: initial,
        onChange,
      });

      act(() => {
        result.current.handleRemoveContainer('main');
      });

      expect(onChange).toHaveBeenCalledWith({});
    });

    it('fires on handleAddEnvVar', () => {
      const onChange = jest.fn();
      const initial = { main: makeContainer() };
      const { result } = renderContainerForm({
        initialContainers: initial,
        onChange,
      });

      act(() => {
        result.current.handleAddEnvVar('main');
      });

      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('fires on handleRemoveEnvVar', () => {
      const onChange = jest.fn();
      const initial = {
        main: makeContainer({ env: [{ key: 'A', value: '1' }] }),
      };
      const { result } = renderContainerForm({
        initialContainers: initial,
        onChange,
      });

      act(() => {
        result.current.handleRemoveEnvVar('main', 0);
      });

      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('useEffect sync with initialContainers', () => {
    it('syncs containers when initialContainers changes', () => {
      const initial1 = { main: makeContainer({ image: 'v1' }) };
      const initial2 = { main: makeContainer({ image: 'v2' }) };

      const { result, rerender } = renderContainerForm({
        initialContainers: initial1,
      });

      expect(result.current.containers.main.image).toBe('v1');

      rerender({ initialContainers: initial2 });

      expect(result.current.containers.main.image).toBe('v2');
    });
  });
});
