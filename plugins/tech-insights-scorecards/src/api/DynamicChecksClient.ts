import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import { parseErrorResponseBody } from '@backstage/errors';
import type { DynamicChecksApi } from './DynamicChecksApi';
import type {
  CheckProblem,
  DryRunResult,
  DynamicCheck,
  DynamicCheckInput,
  FactCollector,
  FactSchema,
  TriggerCollectionResult,
} from './types';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

const SCHEDULER_TASKS_PATH = '/.backstage/scheduler/v1/tasks';

interface SchedulerTask {
  taskId: string;
  settings?: { cadence?: string };
  taskState?: {
    status: 'idle' | 'running';
    startsAt?: string;
    startedAt?: string;
    lastRunEndedAt?: string;
  } | null;
}

/**
 * Turns a failed response into a readable error: the backend's own message
 * from Backstage's standard error body, or a plain description of the status
 * when there isn't one.
 */
async function toError(response: Response): Promise<Error> {
  if (response.status === 401) {
    return new Error('Your session has expired. Sign in again and retry.');
  }
  if (response.status === 403) {
    return new Error("You don't have permission to do this.");
  }
  const { error } = await parseErrorResponseBody(response);
  const message = error.message?.trim();
  return new Error(
    message && !message.startsWith('<')
      ? message
      : `The request failed (${response.status} ${response.statusText}).`,
  );
}

export class DynamicChecksClient implements DynamicChecksApi {
  constructor(
    private readonly discovery: DiscoveryApi,
    private readonly fetchApi: FetchApi,
  ) {}

  private async apiFetch<T = unknown>(
    endpoint: string,
    options?: { method?: HttpMethod; body?: unknown },
  ): Promise<T> {
    const baseUrl = await this.discovery.getBaseUrl('tech-insights');
    const response = await this.fetchApi.fetch(`${baseUrl}${endpoint}`, {
      method: options?.method ?? 'GET',
      headers:
        options?.body !== undefined
          ? { 'Content-Type': 'application/json' }
          : undefined,
      body:
        options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      throw await toError(response);
    }

    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  async listChecks(): Promise<DynamicCheck[]> {
    return this.apiFetch<DynamicCheck[]>('/dynamic-checks');
  }

  async createCheck(input: DynamicCheckInput): Promise<DynamicCheck> {
    return this.apiFetch<DynamicCheck>('/dynamic-checks', {
      method: 'POST',
      body: input,
    });
  }

  async updateCheck(
    id: string,
    input: DynamicCheckInput,
  ): Promise<DynamicCheck> {
    return this.apiFetch<DynamicCheck>(
      `/dynamic-checks/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        body: input,
      },
    );
  }

  async deleteCheck(id: string): Promise<void> {
    await this.apiFetch<void>(`/dynamic-checks/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  async publishCheck(id: string): Promise<void> {
    await this.apiFetch<void>(
      `/dynamic-checks/${encodeURIComponent(id)}/publish`,
      {
        method: 'POST',
      },
    );
  }

  async unpublishCheck(id: string): Promise<void> {
    await this.apiFetch<void>(
      `/dynamic-checks/${encodeURIComponent(id)}/unpublish`,
      {
        method: 'POST',
      },
    );
  }

  async dryRun(
    entityRef: string,
    check: DynamicCheckInput,
  ): Promise<DryRunResult> {
    return this.apiFetch<DryRunResult>('/dynamic-checks/dry-run', {
      method: 'POST',
      body: { entity: entityRef, check },
    });
  }

  async validateRule(
    factIds: string[],
    rule: unknown,
  ): Promise<CheckProblem[]> {
    const { problems } = await this.apiFetch<{ problems: CheckProblem[] }>(
      '/dynamic-checks/validate',
      { method: 'POST', body: { factIds, rule } },
    );
    return problems;
  }

  async listFactSchemas(): Promise<FactSchema[]> {
    return this.apiFetch<FactSchema[]>('/fact-schemas');
  }

  async listFactCollectors(): Promise<FactCollector[]> {
    const [{ tasks }, schemas] = await Promise.all([
      this.apiFetch<{ tasks: SchedulerTask[] }>(SCHEDULER_TASKS_PATH),
      this.listFactSchemas(),
    ]);
    // The scheduler lists every task of the tech-insights plugin; only
    // those named after a fact retriever are collectors.
    const schemasById = new Map(schemas.map(schema => [schema.id, schema]));
    return tasks
      .filter(task => schemasById.has(task.taskId))
      .map(task => ({
        id: task.taskId,
        cadence: task.settings?.cadence,
        status: task.taskState?.status ?? 'idle',
        nextRunAt: task.taskState?.startsAt,
        startedAt: task.taskState?.startedAt,
        lastRunEndedAt: task.taskState?.lastRunEndedAt,
        schema: schemasById.get(task.taskId)!,
      }));
  }

  async triggerFactCollector(id: string): Promise<TriggerCollectionResult> {
    const baseUrl = await this.discovery.getBaseUrl('tech-insights');
    const response = await this.fetchApi.fetch(
      `${baseUrl}/dynamic-checks/fact-retrievers/${encodeURIComponent(
        id,
      )}/trigger`,
      { method: 'POST' },
    );
    if (response.status === 409) {
      return 'already-running';
    }
    if (!response.ok) {
      throw await toError(response);
    }
    return 'started';
  }
}
