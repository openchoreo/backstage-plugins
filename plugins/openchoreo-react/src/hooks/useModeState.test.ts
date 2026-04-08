import { renderHook, act } from '@testing-library/react';
import { useModeState } from './useModeState';

describe('useModeState', () => {
  describe('getMode', () => {
    it('returns plain by default', () => {
      const { result } = renderHook(() => useModeState({ type: 'env' }));
      expect(result.current.getMode('main', 0)).toBe('plain');
    });

    it('derives secret mode from initial env var with secretKeyRef', () => {
      const containers = {
        main: {
          name: 'main',
          env: [
            {
              key: 'DB_PASS',
              valueFrom: { secretKeyRef: { name: 's', key: 'k' } },
            } as any,
          ],
        } as any,
      };
      const { result } = renderHook(() =>
        useModeState({ type: 'env', initialContainers: containers }),
      );
      expect(result.current.getMode('main', 0)).toBe('secret');
    });

    it('derives plain mode from initial env var without secretKeyRef', () => {
      const containers = {
        main: {
          name: 'main',
          env: [{ key: 'PORT', value: '8080' } as any],
        } as any,
      };
      const { result } = renderHook(() =>
        useModeState({ type: 'env', initialContainers: containers }),
      );
      expect(result.current.getMode('main', 0)).toBe('plain');
    });

    it('derives secret mode from initial file var with secretKeyRef', () => {
      const containers = {
        main: {
          name: 'main',
          files: [
            {
              key: 'config',
              valueFrom: { secretKeyRef: { name: 's', key: 'k' } },
            },
          ],
        } as any,
      };
      const { result } = renderHook(() =>
        useModeState({ type: 'file', initialContainers: containers }),
      );
      expect(result.current.getMode('main', 0)).toBe('secret');
    });

    it('returns plain when container does not exist in initialContainers', () => {
      const { result } = renderHook(() =>
        useModeState({ type: 'env', initialContainers: {} }),
      );
      expect(result.current.getMode('missing', 0)).toBe('plain');
    });
  });

  describe('setMode', () => {
    it('stores mode in local state and getMode returns it', () => {
      const { result } = renderHook(() => useModeState({ type: 'env' }));
      act(() => {
        result.current.setMode('main', 0, 'secret');
      });
      expect(result.current.getMode('main', 0)).toBe('secret');
    });

    it('local state takes precedence over derived initial state', () => {
      const containers = {
        main: {
          name: 'main',
          env: [
            {
              key: 'DB_PASS',
              valueFrom: { secretKeyRef: { name: 's', key: 'k' } },
            } as any,
          ],
        } as any,
      };
      const { result } = renderHook(() =>
        useModeState({ type: 'env', initialContainers: containers }),
      );
      expect(result.current.getMode('main', 0)).toBe('secret');

      act(() => {
        result.current.setMode('main', 0, 'plain');
      });
      expect(result.current.getMode('main', 0)).toBe('plain');
    });
  });

  describe('cleanupIndex', () => {
    it('removes mode for deleted index', () => {
      const { result } = renderHook(() => useModeState({ type: 'env' }));
      act(() => {
        result.current.setMode('main', 0, 'secret');
      });
      act(() => {
        result.current.cleanupIndex('main', 0);
      });
      expect(result.current.getMode('main', 0)).toBe('plain');
    });

    it('shifts mode indices after removed item', () => {
      const { result } = renderHook(() => useModeState({ type: 'env' }));
      act(() => {
        result.current.setMode('main', 0, 'plain');
        result.current.setMode('main', 1, 'secret');
        result.current.setMode('main', 2, 'plain');
      });
      // Remove index 0 — index 1 should shift to 0, index 2 to 1
      act(() => {
        result.current.cleanupIndex('main', 0);
      });
      expect(result.current.getMode('main', 0)).toBe('secret');
      expect(result.current.getMode('main', 1)).toBe('plain');
    });
  });

  describe('cleanupContainer', () => {
    it('removes all modes for a container', () => {
      const { result } = renderHook(() => useModeState({ type: 'env' }));
      act(() => {
        result.current.setMode('main', 0, 'secret');
        result.current.setMode('main', 1, 'secret');
        result.current.setMode('sidecar', 0, 'secret');
      });
      act(() => {
        result.current.cleanupContainer('main');
      });
      expect(result.current.getMode('main', 0)).toBe('plain');
      expect(result.current.getMode('main', 1)).toBe('plain');
      expect(result.current.getMode('sidecar', 0)).toBe('secret');
    });
  });
});
