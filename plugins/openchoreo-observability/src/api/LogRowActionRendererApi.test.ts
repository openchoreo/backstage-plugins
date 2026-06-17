import {
  DefaultLogRowActionRendererApi,
  logRowActionRendererApiRef,
} from './LogRowActionRendererApi';

describe('logRowActionRendererApiRef', () => {
  it('uses the canonical id under the openchoreo-observability plugin', () => {
    expect(logRowActionRendererApiRef.id).toBe(
      'plugin.openchoreo-observability.log-row-action-renderer',
    );
  });
});

describe('DefaultLogRowActionRendererApi', () => {
  it('exposes the first renderer when one is contributed', () => {
    const sentinel = 'rendered-action' as any;
    const renderer = jest.fn().mockReturnValue(sentinel);

    const api = DefaultLogRowActionRendererApi.create({
      renderers: [renderer],
    });

    const fakeLog = { id: '1' } as any;
    const getSnapshot = jest.fn();
    expect(api.render(fakeLog, getSnapshot)).toBe(sentinel);
    expect(renderer).toHaveBeenCalledWith(fakeLog, getSnapshot);
  });

  it('falls back to a no-op renderer when no renderers are contributed', () => {
    const api = DefaultLogRowActionRendererApi.create({ renderers: [] });
    expect(api.render({} as any, jest.fn())).toBeNull();
  });

  it('picks the first renderer when multiple are contributed', () => {
    const first = jest.fn().mockReturnValue('first');
    const second = jest.fn().mockReturnValue('second');
    const api = DefaultLogRowActionRendererApi.create({
      renderers: [first as any, second as any],
    });
    expect(api.render({} as any, jest.fn())).toBe('first');
    expect(second).not.toHaveBeenCalled();
  });
});
