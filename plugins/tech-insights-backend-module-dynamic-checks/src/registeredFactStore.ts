import type { SchedulerService } from '@backstage/backend-plugin-api';
import type { TechInsightsStore } from '@backstage-community/plugin-tech-insights-node';

/** The parts of the fact store that check authoring and evaluation read. */
export type CheckFactStore = Pick<
  TechInsightsStore,
  'getLatestSchemas' | 'getLatestFactsByIds'
>;

/**
 * The fact store, limited to the fact retrievers this backend runs.
 *
 * tech-insights never deletes from `fact_schemas`, so a renamed or removed
 * retriever keeps its schema while its facts stop updating. Its engine
 * schedules each registered retriever as a task with the retriever's id, so
 * the scheduler knows which schemas are still current.
 */
export function registeredFactStore(
  store: TechInsightsStore,
  scheduler: Pick<SchedulerService, 'getScheduledTasks'>,
): CheckFactStore {
  return {
    getLatestFactsByIds: (ids, entity) =>
      store.getLatestFactsByIds(ids, entity),
    getLatestSchemas: async ids => {
      const [schemas, tasks] = await Promise.all([
        store.getLatestSchemas(ids),
        scheduler.getScheduledTasks(),
      ]);
      const registered = new Set(tasks.map(task => task.id));
      return schemas.filter(schema => registered.has(String(schema.id)));
    },
  };
}
