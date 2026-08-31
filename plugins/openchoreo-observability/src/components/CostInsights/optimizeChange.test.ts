import type { FetchApi } from '@backstage/core-plugin-api';
import {
  buildOptimizeChange,
  buildRecommendationChanges,
  fetchBindingInfoByEnv,
  hasApplyableRecommendation,
  normalizeEnv,
  resolveReleaseBindingName,
} from './optimizeChange';
import type { CostRowRecommendation } from './types';

const makeFetchApi = (impl: jest.Mock): FetchApi =>
  ({ fetch: impl } as unknown as FetchApi);

const okResponse = (body: unknown) =>
  ({ ok: true, json: async () => body } as Response);

describe('resolveReleaseBindingName', () => {
  const base = {
    openchoreoBaseUrl: 'http://backend/api/openchoreo',
    namespaceName: 'default',
    projectName: 'demo',
    componentName: 'ad',
  };

  it('matches the binding by environment and returns its name', async () => {
    const fetch = jest.fn().mockResolvedValue(
      okResponse({
        data: {
          items: [
            { name: 'ad-dev', environment: 'dev' },
            { name: 'ad-prod', environment: 'prod' },
          ],
        },
      }),
    );
    const name = await resolveReleaseBindingName({
      ...base,
      fetchApi: makeFetchApi(fetch),
      environment: 'prod',
    });
    expect(name).toBe('ad-prod');
    // The query targets the component's bindings.
    expect(fetch.mock.calls[0][0]).toContain('componentName=ad');
    expect(fetch.mock.calls[0][0]).toContain('projectName=demo');
    expect(fetch.mock.calls[0][0]).toContain('namespaceName=default');
  });

  it('falls back to a case-insensitive environment match', async () => {
    const fetch = jest.fn().mockResolvedValue(
      okResponse({
        data: { items: [{ name: 'ad-dev', environment: 'Dev' }] },
      }),
    );
    const name = await resolveReleaseBindingName({
      ...base,
      fetchApi: makeFetchApi(fetch),
      environment: 'dev',
    });
    expect(name).toBe('ad-dev');
  });

  it('throws when no binding matches the environment', async () => {
    const fetch = jest.fn().mockResolvedValue(
      okResponse({
        data: { items: [{ name: 'ad-dev', environment: 'dev' }] },
      }),
    );
    await expect(
      resolveReleaseBindingName({
        ...base,
        fetchApi: makeFetchApi(fetch),
        environment: 'staging',
      }),
    ).rejects.toThrow(/No release binding found/);
  });

  it('throws when the lookup request fails', async () => {
    const fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, statusText: 'Bad Gateway' } as Response);
    await expect(
      resolveReleaseBindingName({
        ...base,
        fetchApi: makeFetchApi(fetch),
        environment: 'dev',
      }),
    ).rejects.toThrow(/Failed to look up release bindings/);
  });
});

describe('buildOptimizeChange', () => {
  it('builds field patches for every present resource value', () => {
    const rec: CostRowRecommendation = {
      cpuRequest: '50m',
      cpuLimit: '100m',
      memoryRequest: '64Mi',
      memoryLimit: '128Mi',
      cpuCost: 1,
      memoryCost: 1,
      total: 2,
    };
    const change = buildOptimizeChange('ad-dev', rec);
    expect(change.release_binding).toBe('ad-dev');
    expect(change.fields).toEqual([
      {
        json_pointer:
          '/spec/componentTypeEnvironmentConfigs/resources/requests/cpu',
        value: '50m',
      },
      {
        json_pointer:
          '/spec/componentTypeEnvironmentConfigs/resources/limits/cpu',
        value: '100m',
      },
      {
        json_pointer:
          '/spec/componentTypeEnvironmentConfigs/resources/requests/memory',
        value: '64Mi',
      },
      {
        json_pointer:
          '/spec/componentTypeEnvironmentConfigs/resources/limits/memory',
        value: '128Mi',
      },
    ]);
  });

  it('omits absent resource values', () => {
    const rec: CostRowRecommendation = {
      cpuRequest: '50m',
      cpuCost: 1,
      memoryCost: 1,
      total: 2,
    };
    const change = buildOptimizeChange('ad-dev', rec);
    expect(change.fields).toEqual([
      {
        json_pointer:
          '/spec/componentTypeEnvironmentConfigs/resources/requests/cpu',
        value: '50m',
      },
    ]);
  });
});

describe('fetchBindingInfoByEnv', () => {
  const base = {
    openchoreoBaseUrl: 'http://backend/api/openchoreo',
    namespaceName: 'default',
    projectName: 'demo',
    componentName: 'ad',
  };

  it('maps each binding by normalized environment with its live resources', async () => {
    const fetch = jest.fn().mockResolvedValue(
      okResponse({
        data: {
          items: [
            {
              name: 'ad-dev',
              environment: 'Dev',
              lastSpecUpdateTime: '2026-08-01T00:00:00.000Z',
              componentTypeEnvironmentConfigs: {
                resources: {
                  requests: { cpu: '100m', memory: '128Mi' },
                  limits: { cpu: '200m', memory: '256Mi' },
                },
              },
            },
          ],
        },
      }),
    );
    const map = await fetchBindingInfoByEnv({
      ...base,
      fetchApi: makeFetchApi(fetch),
    });
    // Keyed by the lowercased environment name.
    expect(map.get('dev')).toEqual({
      cpuRequest: '100m',
      cpuLimit: '200m',
      memoryRequest: '128Mi',
      memoryLimit: '256Mi',
      lastSpecUpdateTime: '2026-08-01T00:00:00.000Z',
    });
    expect(map.get('Dev')).toBeUndefined();
  });

  it('returns an empty map when the request is not ok', async () => {
    const fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, statusText: 'nope' } as Response);
    const map = await fetchBindingInfoByEnv({
      ...base,
      fetchApi: makeFetchApi(fetch),
    });
    expect(map.size).toBe(0);
  });

  it('returns an empty map when the fetch throws', async () => {
    const fetch = jest.fn().mockRejectedValue(new Error('network'));
    const map = await fetchBindingInfoByEnv({
      ...base,
      fetchApi: makeFetchApi(fetch),
    });
    expect(map.size).toBe(0);
  });
});

describe('normalizeEnv', () => {
  it('lowercases the environment name', () => {
    expect(normalizeEnv('Prod')).toBe('prod');
    expect(normalizeEnv('dev')).toBe('dev');
  });
});

describe('buildRecommendationChanges', () => {
  it('emits modified and new diffs and omits unchanged/absent values', () => {
    const changes = buildRecommendationChanges({
      cpuRequest: '50m',
      memoryRequest: '64Mi',
      cpuCost: 1,
      memoryCost: 1,
      total: 2,
      current: {
        cpuRequest: '100m', // modified
        memoryRequest: '64Mi', // unchanged -> omitted
      },
    });
    expect(changes).toEqual([
      {
        path: 'resources.requests.cpu',
        type: 'modified',
        oldValue: '100m',
        newValue: '50m',
      },
    ]);
  });

  it('marks a value with no current as new', () => {
    const changes = buildRecommendationChanges({
      cpuRequest: '50m',
      cpuCost: 1,
      memoryCost: 1,
      total: 2,
    });
    expect(changes).toEqual([
      {
        path: 'resources.requests.cpu',
        type: 'new',
        oldValue: undefined,
        newValue: '50m',
      },
    ]);
  });
});

describe('hasApplyableRecommendation', () => {
  it('is false when undefined or has no resource values', () => {
    expect(hasApplyableRecommendation(undefined)).toBe(false);
    expect(
      hasApplyableRecommendation({ cpuCost: 1, memoryCost: 1, total: 2 }),
    ).toBe(false);
  });

  it('is true when at least one resource value is present', () => {
    expect(
      hasApplyableRecommendation({
        cpuRequest: '50m',
        cpuCost: 1,
        memoryCost: 1,
        total: 2,
      }),
    ).toBe(true);
  });
});
