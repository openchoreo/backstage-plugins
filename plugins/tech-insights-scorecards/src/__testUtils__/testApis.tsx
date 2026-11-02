import type { ReactElement } from 'react';
import { SWRConfig } from 'swr';
import {
  mockApis,
  renderInTestApp,
  TestApiProvider,
} from '@backstage/test-utils';
import { configApiRef } from '@backstage/core-plugin-api';
import { toastApiRef } from '@backstage/frontend-plugin-api';
import { catalogApiRef, entityRouteRef } from '@backstage/plugin-catalog-react';
import { permissionApiRef } from '@backstage/plugin-permission-react';
import { maturityApiRef } from '@backstage-community/plugin-tech-insights-maturity';
import {
  dynamicCheckManagePermission,
  dynamicCheckReadPermission,
} from '@openchoreo/backstage-plugin-tech-insights-dynamic-checks-common';
import { dynamicChecksApiRef } from '../api/DynamicChecksApi';
import type { DynamicCheck, FactCollector, FactSchema } from '../api/types';

export function check(overrides: Partial<DynamicCheck> = {}): DynamicCheck {
  return {
    id: 'readme',
    type: 'json-rules-engine',
    name: 'Has a README',
    factIds: ['repoFacts'],
    metadata: { rank: 1, category: 'Documentation' },
    filter: { kind: 'Component' },
    rule: { conditions: { all: [] } },
    status: 'draft',
    ...overrides,
  };
}

export const repoSchema: FactSchema = {
  id: 'repoFacts',
  version: '1.0.0',
  entityFilter: [{ kind: 'Component' }],
  hasReadme: { type: 'boolean', description: 'The repository has a README' },
};

export const apiSchema: FactSchema = {
  id: 'apiFacts',
  version: '0.1.0',
  entityFilter: { kind: 'API' },
};

export function collector(
  overrides: Partial<FactCollector> = {},
): FactCollector {
  return {
    id: 'repoFacts',
    cadence: '0 * * * *',
    status: 'idle',
    lastRunEndedAt: '2026-01-01T00:00:00.000Z',
    nextRunAt: '2026-01-01T01:00:00.000Z',
    schema: repoSchema,
    ...overrides,
  };
}

export function mockDynamicChecksApi() {
  return {
    listChecks: jest.fn(async (): Promise<DynamicCheck[]> => []),
    createCheck: jest.fn(async (input: Omit<DynamicCheck, 'id' | 'type'>) =>
      check({ ...input, id: 'created' }),
    ),
    updateCheck: jest.fn(
      async (id: string, input: Omit<DynamicCheck, 'id' | 'type'>) =>
        check({ ...input, id }),
    ),
    deleteCheck: jest.fn(async () => {}),
    publishCheck: jest.fn(async () => {}),
    unpublishCheck: jest.fn(async () => {}),
    dryRun: jest.fn(),
    validateRule: jest.fn(async () => []),
    listFactSchemas: jest.fn(async (): Promise<FactSchema[]> => [repoSchema]),
    listFactCollectors: jest.fn(
      async (): Promise<FactCollector[]> => [collector()],
    ),
    triggerFactCollector: jest.fn(
      async (): Promise<'started' | 'already-running'> => 'started',
    ),
  };
}

export type MockDynamicChecksApi = ReturnType<typeof mockDynamicChecksApi>;

type ConfigData = NonNullable<
  NonNullable<Parameters<typeof mockApis.config>[0]>['data']
>;

interface RenderOptions {
  api?: MockDynamicChecksApi;
  canRead?: boolean;
  canManage?: boolean;
  config?: ConfigData;
}

/**
 * Renders `ui` in a test app with the APIs the Scorecards components use.
 * Permissions are answered per permission, so a test can grant read alone.
 * `usePermission` caches answers in SWR, so each render gets its own cache
 * and one test's answer doesn't leak into the next.
 */
export async function renderWithApis(
  ui: ReactElement,
  options: RenderOptions = {},
) {
  const {
    api = mockDynamicChecksApi(),
    canRead = true,
    canManage = true,
    config = {},
  } = options;
  const allowed: Record<string, boolean> = {
    [dynamicCheckReadPermission.name]: canRead,
    [dynamicCheckManagePermission.name]: canManage,
  };
  const permissionApi = {
    authorize: jest.fn(
      async ({ permission }: { permission: { name: string } }) => ({
        result: allowed[permission.name] ? 'ALLOW' : 'DENY',
      }),
    ),
  } as unknown as typeof permissionApiRef.T;
  const catalogApi = {
    getEntityFacets: jest.fn(async () => ({
      facets: {
        kind: [
          { value: 'API', count: 1 },
          { value: 'Component', count: 1 },
        ],
      },
    })),
    queryEntities: jest.fn(async () => ({
      items: [],
      totalItems: 0,
      pageInfo: {},
    })),
    getEntities: jest.fn(async () => ({ items: [] })),
  };
  const maturityApi = {
    getAllChecks: jest.fn(async () => []),
    getBulkMaturityCheckResults: jest.fn(async () => []),
  };
  const toastApi = { post: jest.fn() };

  const rendered = await renderInTestApp(
    <SWRConfig value={{ provider: () => new Map() }}>
      <TestApiProvider
        apis={[
          [dynamicChecksApiRef, api],
          [catalogApiRef, catalogApi],
          [maturityApiRef, maturityApi],
          [permissionApiRef, permissionApi],
          [toastApiRef, toastApi],
          [configApiRef, mockApis.config({ data: config })],
        ]}
      >
        {ui}
      </TestApiProvider>
    </SWRConfig>,
    { mountedRoutes: { '/catalog/:namespace/:kind/:name': entityRouteRef } },
  );
  return { ...rendered, api, catalogApi, maturityApi, toastApi };
}
