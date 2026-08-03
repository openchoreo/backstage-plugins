import { renderHook, waitFor } from '@testing-library/react';
import { Entity } from '@backstage/catalog-model';
import { createApiRef } from '@backstage/core-plugin-api';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useIncidentsSummary } from './useIncidentsSummary';
import type { Environment } from './useEnvironmentData';

// The hook resolves the observability API by id via useApiHolder().get(). It is
// created inline in the source (not exported), so we register a local ref with
// the same id — Backstage resolves API factories by id.
const observabilityApiRef = createApiRef<any>({
  id: 'plugin.openchoreo-observability.service',
});

const entity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'checkout',
    namespace: 'default',
    annotations: {
      [CHOREO_ANNOTATIONS.COMPONENT]: 'checkout',
      [CHOREO_ANNOTATIONS.PROJECT]: 'shop',
      [CHOREO_ANNOTATIONS.NAMESPACE]: 'ns-1',
    },
  },
};

jest.mock('@backstage/plugin-catalog-react', () => ({
  ...jest.requireActual('@backstage/plugin-catalog-react'),
  useEntity: () => ({ entity }),
}));

function makeEnv(name: string): Environment {
  return {
    name,
    deployment: { status: 'Ready' },
    endpoints: [],
  } as Environment;
}

function makeIncident(status: 'active' | 'resolved') {
  return {
    incidentId: `inc-${status}`,
    alertId: 'alert-1',
    status,
  };
}

function renderUseIncidentsSummary(
  environments: Environment[],
  observabilityApi: unknown,
) {
  const apis: [unknown, unknown][] = observabilityApi
    ? [[observabilityApiRef, observabilityApi]]
    : [];
  return renderHook(() => useIncidentsSummary(environments), {
    wrapper: createQueryWrapper(apis),
  });
}

describe('useIncidentsSummary', () => {
  it('reports loading with zero counts on the first fetch', () => {
    const observabilityApi = {
      getIncidents: jest.fn().mockReturnValue(new Promise(() => {})),
    };
    const environments = [makeEnv('development')];
    const { result } = renderUseIncidentsSummary(
      environments,
      observabilityApi,
    );

    const dev = result.current.get('development');
    expect(dev?.loading).toBe(true);
    expect(dev?.activeCount).toBe(0);
  });

  it('resolves active incident counts per environment', async () => {
    const observabilityApi = {
      getIncidents: jest.fn().mockResolvedValue({
        incidents: [makeIncident('active'), makeIncident('resolved')],
        total: 2,
      }),
    };
    const environments = [makeEnv('development'), makeEnv('production')];
    const { result } = renderUseIncidentsSummary(
      environments,
      observabilityApi,
    );

    await waitFor(() =>
      expect(result.current.get('development')?.loading).toBe(false),
    );

    expect(result.current.get('development')?.activeCount).toBe(1);
    expect(result.current.get('production')?.activeCount).toBe(1);
    // Background-refresh flag: loading settles to false once data is on screen.
    expect(result.current.get('production')?.loading).toBe(false);
    expect(observabilityApi.getIncidents).toHaveBeenCalledTimes(2);
  });

  it('degrades a per-environment failure to a zero count', async () => {
    const observabilityApi = {
      getIncidents: jest
        .fn()
        .mockResolvedValueOnce({
          incidents: [makeIncident('active')],
          total: 1,
        })
        .mockRejectedValueOnce(new Error('observability partial')),
    };
    const environments = [makeEnv('development'), makeEnv('production')];
    const { result } = renderUseIncidentsSummary(
      environments,
      observabilityApi,
    );

    await waitFor(() =>
      expect(result.current.get('development')?.loading).toBe(false),
    );

    expect(result.current.get('development')?.activeCount).toBe(1);
    // A rejected env resolves to 0 rather than failing the whole batch.
    expect(result.current.get('production')?.activeCount).toBe(0);
  });

  it('stays disabled (non-loading, zero) when observability is not installed', async () => {
    const environments = [makeEnv('development')];
    const { result } = renderUseIncidentsSummary(environments, undefined);

    // enabled:false leaves the query non-loading; the map still has an entry.
    await waitFor(() =>
      expect(result.current.get('development')?.loading).toBe(false),
    );
    expect(result.current.get('development')?.activeCount).toBe(0);
  });
});
