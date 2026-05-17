import { renderHook } from '@testing-library/react';
import type { WorkloadResource } from '@openchoreo/backstage-plugin-common';
import { useWorkloadChanges } from './useWorkloadChanges';

function buildWorkload(spec: Record<string, unknown>): WorkloadResource {
  return {
    apiVersion: 'openchoreo.dev/v1alpha1',
    kind: 'Workload',
    metadata: { name: 'orders-api', namespace: 'default' },
    spec,
  } as unknown as WorkloadResource;
}

describe('useWorkloadChanges', () => {
  describe('dependencies.resources', () => {
    const dbResource = {
      ref: 'orders-db',
      envBindings: { host: 'DB_HOST', password: 'DB_PASSWORD' },
      fileBindings: { password: '/etc/db/password' },
    };
    const cacheResource = {
      ref: 'orders-cache',
      envBindings: { host: 'REDIS_HOST' },
    };

    it('flags hasChanges when a resource dependency is added', () => {
      const initial = buildWorkload({
        container: { image: 'nginx:1' },
        dependencies: { resources: [dbResource] },
      });
      const current = buildWorkload({
        container: { image: 'nginx:1' },
        dependencies: { resources: [dbResource, cacheResource] },
      });

      const { result } = renderHook(() =>
        useWorkloadChanges(initial, current),
      );

      expect(result.current.hasChanges).toBe(true);
      const newAdd = result.current.dependencies.find(c => c.type === 'new');
      expect(newAdd?.path).toBe('orders-cache');
    });

    it('flags hasChanges when a resource dependency is removed', () => {
      const initial = buildWorkload({
        container: { image: 'nginx:1' },
        dependencies: { resources: [dbResource, cacheResource] },
      });
      const current = buildWorkload({
        container: { image: 'nginx:1' },
        dependencies: { resources: [dbResource] },
      });

      const { result } = renderHook(() =>
        useWorkloadChanges(initial, current),
      );

      expect(result.current.hasChanges).toBe(true);
      const removal = result.current.dependencies.find(
        c => c.type === 'removed',
      );
      expect(removal?.path).toBe('orders-cache');
    });

    it('flags hasChanges when a resource binding is modified', () => {
      const initial = buildWorkload({
        container: { image: 'nginx:1' },
        dependencies: { resources: [dbResource] },
      });
      const current = buildWorkload({
        container: { image: 'nginx:1' },
        dependencies: {
          resources: [
            {
              ...dbResource,
              envBindings: { ...dbResource.envBindings, host: 'NEW_DB_HOST' },
            },
          ],
        },
      });

      const { result } = renderHook(() =>
        useWorkloadChanges(initial, current),
      );

      expect(result.current.hasChanges).toBe(true);
      expect(
        result.current.dependencies.some(c =>
          c.path.startsWith('orders-db.envBindings'),
        ),
      ).toBe(true);
    });

    it('surfaces both endpoint and resource changes together', () => {
      const endpointDep = {
        component: 'payments-svc',
        name: 'orders',
        visibility: 'project',
        envBindings: { address: 'PAYMENTS_ADDR' },
      };
      const initial = buildWorkload({
        container: { image: 'nginx:1' },
        dependencies: {
          endpoints: [endpointDep],
          resources: [dbResource],
        },
      });
      const current = buildWorkload({
        container: { image: 'nginx:1' },
        dependencies: {
          endpoints: [endpointDep, { ...endpointDep, name: 'invoices' }],
          resources: [dbResource, cacheResource],
        },
      });

      const { result } = renderHook(() =>
        useWorkloadChanges(initial, current),
      );

      expect(result.current.hasChanges).toBe(true);
      // Both sides reported in the dependencies bucket.
      const paths = result.current.dependencies.map(c => c.path);
      expect(paths).toContain('payments-svc/invoices');
      expect(paths).toContain('orders-cache');
    });

    it('reports no changes when resources are byte-identical', () => {
      const initial = buildWorkload({
        container: { image: 'nginx:1' },
        dependencies: { resources: [dbResource, cacheResource] },
      });
      const current = buildWorkload({
        container: { image: 'nginx:1' },
        dependencies: { resources: [dbResource, cacheResource] },
      });

      const { result } = renderHook(() =>
        useWorkloadChanges(initial, current),
      );

      expect(result.current.hasChanges).toBe(false);
      expect(result.current.dependencies).toEqual([]);
    });
  });
});
