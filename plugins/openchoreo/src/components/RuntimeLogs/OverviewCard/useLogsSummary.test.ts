import { renderHook, waitFor, act } from '@testing-library/react';
import { Entity } from '@backstage/catalog-model';
import { createApiRef } from '@backstage/core-plugin-api';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { useLogsSummary } from './useLogsSummary';
import type { Environment, LogEntry, LogsResponse } from '../types';

// Observability API is resolved by id via useApiHolder().get(); register a local
// ref with the same id (it is created inline in the source, not exported).
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
  return { id: name, name, resourceName: name };
}

function makeLog(level: string, timestamp?: string): LogEntry {
  return { level, timestamp, log: `${level} message` };
}

function makeLogsResponse(logs: LogEntry[]): LogsResponse {
  return { logs, total: logs.length };
}

function renderUseLogsSummary(
  client: unknown,
  observabilityApi: unknown,
  getRuntimeLogs?: jest.Mock,
) {
  const observability =
    observabilityApi ?? (getRuntimeLogs ? { getRuntimeLogs } : undefined);
  const apis: [unknown, unknown][] = [[openChoreoClientApiRef, client]];
  if (observability) {
    apis.push([observabilityApiRef, observability]);
  }
  return renderHook(() => useLogsSummary(), {
    wrapper: createQueryWrapper(apis),
  });
}

describe('useLogsSummary', () => {
  it('starts loading with zero counts', () => {
    const client = {
      getEnvironments: jest.fn().mockReturnValue(new Promise(() => {})),
    };
    const getRuntimeLogs = jest.fn();
    const { result } = renderUseLogsSummary(client, undefined, getRuntimeLogs);

    expect(result.current.loading).toBe(true);
    expect(result.current.errorCount).toBe(0);
    expect(result.current.warningCount).toBe(0);
    expect(result.current.refreshing).toBe(false);
  });

  it('resolves error/warning counts and last activity time', async () => {
    const client = {
      getEnvironments: jest.fn().mockResolvedValue([makeEnv('development')]),
    };
    const getRuntimeLogs = jest
      .fn()
      .mockResolvedValue(
        makeLogsResponse([
          makeLog('ERROR', '2024-06-01T00:00:00Z'),
          makeLog('WARN'),
          makeLog('INFO'),
        ]),
      );
    const { result } = renderUseLogsSummary(client, undefined, getRuntimeLogs);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.errorCount).toBe(1);
    expect(result.current.warningCount).toBe(1);
    expect(result.current.lastActivityTime).toBe('2024-06-01T00:00:00Z');
    expect(result.current.healthStatus).toBe('error');
    expect(result.current.error).toBeNull();
    expect(result.current.observabilityDisabled).toBe(false);
    // Background-refresh flag is exposed as `refreshing` and settled.
    expect(result.current.refreshing).toBe(false);
  });

  it('treats a missing observability plugin as disabled, not an error', async () => {
    const client = {
      getEnvironments: jest.fn().mockResolvedValue([makeEnv('development')]),
    };
    // No observability API registered.
    const { result } = renderUseLogsSummary(client, undefined);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.observabilityDisabled).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.errorCount).toBe(0);
  });

  it('keeps counts and flips refreshing during a background refresh', async () => {
    const client = {
      getEnvironments: jest.fn().mockResolvedValue([makeEnv('development')]),
    };
    let releaseSecond: (v: LogsResponse) => void = () => {};
    const secondPending = new Promise<LogsResponse>(resolve => {
      releaseSecond = resolve;
    });
    const getRuntimeLogs = jest
      .fn()
      .mockResolvedValueOnce(makeLogsResponse([makeLog('ERROR')]))
      .mockReturnValueOnce(secondPending);
    const { result } = renderUseLogsSummary(client, undefined, getRuntimeLogs);

    await waitFor(() => expect(result.current.errorCount).toBe(1));

    await act(async () => {
      result.current.refresh().catch(() => {});
    });

    await waitFor(() => expect(result.current.refreshing).toBe(true));
    expect(result.current.loading).toBe(false);
    expect(result.current.errorCount).toBe(1);

    await act(async () => {
      releaseSecond(makeLogsResponse([makeLog('ERROR'), makeLog('ERROR')]));
      await secondPending;
    });

    await waitFor(() => expect(result.current.errorCount).toBe(2));
    expect(result.current.refreshing).toBe(false);
  });
});
