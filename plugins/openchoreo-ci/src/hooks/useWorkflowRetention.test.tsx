/**
 * Tests for useWorkflowRetention + formatRetentionDuration.
 *
 * Unlike the other CI data hooks, useWorkflowRetention returns a bare
 * `string | undefined` (the ttlAfterCompletion value), NOT the
 * `{ loading, isRefetching, error }` envelope — so there is no
 * background-refresh flag to assert here. The meaningful surface is:
 *   - the `enabled` gate (no catalog hit until name+kind+namespace are set),
 *   - the entity-ref it builds (Workflow vs ClusterWorkflow namespace rule),
 *   - the resolved value once the query settles,
 *   - formatRetentionDuration's parsing.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { createQueryWrapper } from '@openchoreo/test-utils';
import {
  useWorkflowRetention,
  formatRetentionDuration,
} from './useWorkflowRetention';

const mockCatalogApi = { getEntityByRef: jest.fn() };

function renderRetention(
  workflowName?: string,
  workflowKind?: 'Workflow' | 'ClusterWorkflow',
  namespace?: string,
) {
  return renderHook(
    () => useWorkflowRetention(workflowName, workflowKind, namespace),
    {
      wrapper: createQueryWrapper([[catalogApiRef, mockCatalogApi as any]]),
    },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useWorkflowRetention', () => {
  it('does not hit the catalog while required args are missing (disabled query)', async () => {
    const { result } = renderRetention(undefined, 'Workflow', 'ns-1');

    // Disabled query: value stays undefined and the catalog is never called.
    expect(result.current).toBeUndefined();
    // Give any (unexpected) async work a tick to flush.
    await waitFor(() =>
      expect(mockCatalogApi.getEntityByRef).not.toHaveBeenCalled(),
    );
  });

  it('resolves the ttlAfterCompletion from a Workflow entity', async () => {
    mockCatalogApi.getEntityByRef.mockResolvedValueOnce({
      spec: { ttlAfterCompletion: '10d' },
    });

    const { result } = renderRetention('wf-1', 'Workflow', 'ns-1');

    // Undefined until the query settles.
    expect(result.current).toBeUndefined();

    await waitFor(() => expect(result.current).toBe('10d'));
    expect(mockCatalogApi.getEntityByRef).toHaveBeenCalledWith(
      'workflow:ns-1/wf-1',
    );
  });

  it('uses the openchoreo-cluster namespace for a ClusterWorkflow', async () => {
    mockCatalogApi.getEntityByRef.mockResolvedValueOnce({
      spec: { ttlAfterCompletion: '2h30m' },
    });

    const { result } = renderRetention('cw-1', 'ClusterWorkflow', 'ignored-ns');

    await waitFor(() => expect(result.current).toBe('2h30m'));
    expect(mockCatalogApi.getEntityByRef).toHaveBeenCalledWith(
      'clusterworkflow:openchoreo-cluster/cw-1',
    );
  });

  it('returns undefined when the entity has no ttlAfterCompletion', async () => {
    mockCatalogApi.getEntityByRef.mockResolvedValueOnce({ spec: {} });

    const { result } = renderRetention('wf-1', 'Workflow', 'ns-1');

    await waitFor(() =>
      expect(mockCatalogApi.getEntityByRef).toHaveBeenCalled(),
    );
    expect(result.current).toBeUndefined();
  });
});

describe('formatRetentionDuration', () => {
  it('formats days', () => {
    expect(formatRetentionDuration('10d')).toBe('10 days');
    expect(formatRetentionDuration('1d')).toBe('1 day');
  });

  it('formats a compound days+hours duration', () => {
    expect(formatRetentionDuration('10d1h30m')).toBe('10 days 1 hour');
  });

  it('drops minutes once days are present', () => {
    expect(formatRetentionDuration('2d45m')).toBe('2 days');
  });

  it('keeps minutes when there are no days', () => {
    expect(formatRetentionDuration('30m')).toBe('30 minutes');
    expect(formatRetentionDuration('1m')).toBe('1 minute');
  });

  it('falls back to the raw string when nothing parses', () => {
    expect(formatRetentionDuration('forever')).toBe('forever');
  });
});
