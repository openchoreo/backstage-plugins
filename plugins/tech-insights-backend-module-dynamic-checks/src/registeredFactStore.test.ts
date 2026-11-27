import type { TechInsightsStore } from '@backstage-community/plugin-tech-insights-node';
import { registeredFactStore } from './registeredFactStore';

describe('registeredFactStore', () => {
  const setup = (taskIds: string[]) => {
    const store = {
      getLatestSchemas: jest.fn(async () => [
        { id: 'current', version: '0.1.0' },
        { id: 'retired', version: '0.1.0' },
      ]),
      getLatestFactsByIds: jest.fn(async () => ({})),
    };
    const scheduler = {
      getScheduledTasks: jest.fn(async () =>
        taskIds.map(id => ({ id, pluginId: 'tech-insights', scope: 'global' })),
      ),
    };
    return {
      store,
      factStore: registeredFactStore(
        store as unknown as TechInsightsStore,
        scheduler as any,
      ),
    };
  };

  it('leaves out schemas of retrievers that are not scheduled', async () => {
    const { factStore } = setup(['current', 'some-other-task']);

    await expect(factStore.getLatestSchemas()).resolves.toEqual([
      { id: 'current', version: '0.1.0' },
    ]);
  });

  it('passes the requested ids on to the store', async () => {
    const { factStore, store } = setup(['current']);

    await factStore.getLatestSchemas(['current']);

    expect(store.getLatestSchemas).toHaveBeenCalledWith(['current']);
  });

  it('reads facts from the store unchanged', async () => {
    const { factStore, store } = setup([]);

    await factStore.getLatestFactsByIds(['retired'], 'component:default/a');

    expect(store.getLatestFactsByIds).toHaveBeenCalledWith(
      ['retired'],
      'component:default/a',
    );
  });
});
