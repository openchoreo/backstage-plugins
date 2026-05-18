import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';
import { transformResourceReleaseBinding } from './resource-release-binding';

type ResourceReleaseBinding =
  OpenChoreoComponents['schemas']['ResourceReleaseBinding'];

function makeBinding(overrides: Partial<ResourceReleaseBinding> = {}) {
  return {
    metadata: {
      name: 'db-dev',
      namespace: 'acme',
      creationTimestamp: '2025-01-01T00:00:00Z',
    },
    spec: {
      owner: { projectName: 'shop', resourceName: 'db' },
      environment: 'dev',
      resourceRelease: 'db-abc123',
      retainPolicy: 'Delete' as const,
    },
    status: {
      conditions: [
        {
          type: 'Ready',
          status: 'True',
          reason: 'Ready',
          message: 'binding is ready',
          observedGeneration: 1,
        },
      ],
    },
    ...overrides,
  } as ResourceReleaseBinding;
}

describe('transformResourceReleaseBinding', () => {
  it('maps the basic spec and metadata fields', () => {
    const result = transformResourceReleaseBinding(makeBinding());

    expect(result.name).toBe('db-dev');
    expect(result.resourceName).toBe('db');
    expect(result.projectName).toBe('shop');
    expect(result.namespaceName).toBe('acme');
    expect(result.environment).toBe('dev');
    expect(result.releaseName).toBe('db-abc123');
    expect(result.retainPolicy).toBe('Delete');
    expect(result.createdAt).toBe('2025-01-01T00:00:00Z');
  });

  it('derives Ready status from conditions', () => {
    const result = transformResourceReleaseBinding(makeBinding());
    expect(result.status).toBe('Ready');
  });

  it('omits outputs when status.outputs is absent', () => {
    const result = transformResourceReleaseBinding(makeBinding());
    expect(result.outputs).toBeUndefined();
  });

  it('propagates value-kind outputs', () => {
    const binding = makeBinding({
      status: {
        outputs: [
          { name: 'host', value: 'db.dev.svc.cluster.local' },
          { name: 'port', value: '5432' },
        ],
      } as any,
    });

    const result = transformResourceReleaseBinding(binding);

    expect(result.outputs).toEqual([
      { name: 'host', value: 'db.dev.svc.cluster.local' },
      { name: 'port', value: '5432' },
    ]);
  });

  it('propagates secretKeyRef-kind outputs without resolved values', () => {
    const binding = makeBinding({
      status: {
        outputs: [
          {
            name: 'password',
            secretKeyRef: { name: 'db-creds', key: 'password' },
          },
        ],
      } as any,
    });

    const result = transformResourceReleaseBinding(binding);

    expect(result.outputs).toEqual([
      {
        name: 'password',
        secretKeyRef: { name: 'db-creds', key: 'password' },
      },
    ]);
    expect(result.outputs?.[0].value).toBeUndefined();
  });

  it('propagates configMapKeyRef-kind outputs', () => {
    const binding = makeBinding({
      status: {
        outputs: [
          {
            name: 'database',
            configMapKeyRef: { name: 'db-config', key: 'dbname' },
          },
        ],
      } as any,
    });

    const result = transformResourceReleaseBinding(binding);

    expect(result.outputs).toEqual([
      {
        name: 'database',
        configMapKeyRef: { name: 'db-config', key: 'dbname' },
      },
    ]);
  });

  it('handles a mixed-kind outputs list', () => {
    const binding = makeBinding({
      status: {
        outputs: [
          { name: 'host', value: 'db.dev.svc' },
          { name: 'password', secretKeyRef: { name: 's', key: 'p' } },
          { name: 'database', configMapKeyRef: { name: 'c', key: 'd' } },
        ],
      } as any,
    });

    const result = transformResourceReleaseBinding(binding);

    expect(result.outputs).toHaveLength(3);
    expect(result.outputs?.[0].value).toBe('db.dev.svc');
    expect(result.outputs?.[1].secretKeyRef).toEqual({ name: 's', key: 'p' });
    expect(result.outputs?.[2].configMapKeyRef).toEqual({
      name: 'c',
      key: 'd',
    });
  });
});
