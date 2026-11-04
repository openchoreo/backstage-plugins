import { createApiRef } from '@backstage/frontend-plugin-api';
import type {
  CheckProblem,
  DryRunResult,
  DynamicCheck,
  DynamicCheckInput,
  FactCollector,
  FactSchema,
  TriggerCollectionResult,
} from './types';

/**
 * Client for the dynamic-checks HTTP API, mounted by
 * `tech-insights-backend-module-dynamic-checks` under the `tech-insights`
 * plugin's own base path.
 */
export interface DynamicChecksApi {
  listChecks(): Promise<DynamicCheck[]>;
  createCheck(input: DynamicCheckInput): Promise<DynamicCheck>;
  updateCheck(id: string, input: DynamicCheckInput): Promise<DynamicCheck>;
  deleteCheck(id: string): Promise<void>;
  publishCheck(id: string): Promise<void>;
  unpublishCheck(id: string): Promise<void>;
  dryRun(entityRef: string, check: DynamicCheckInput): Promise<DryRunResult>;
  /** Why a rule over the given retrievers' facts can't be evaluated, if it can't. */
  validateRule(factIds: string[], rule: unknown): Promise<CheckProblem[]>;
  /** Schemas of the fact retrievers registered with tech-insights. */
  listFactSchemas(): Promise<FactSchema[]>;
  /** Scheduled fact retrievers with their schedule and last/next run. */
  listFactCollectors(): Promise<FactCollector[]>;
  /**
   * Starts a collection run now, for every entity the retriever covers. Only
   * brings the next scheduled run forward; poll `listFactCollectors` to see
   * it finish.
   */
  triggerFactCollector(id: string): Promise<TriggerCollectionResult>;
}

export const dynamicChecksApiRef = createApiRef<DynamicChecksApi>().with({
  id: 'plugin.tech-insights-scorecards.dynamic-checks',
  pluginId: 'tech-insights-scorecards',
});
