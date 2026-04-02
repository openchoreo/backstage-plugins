import { Entity } from '@backstage/catalog-model';
import {
  buildEntityPath,
  buildEnvironmentsBasePath,
  buildWorkflowsBasePath,
  buildRuntimeLogsBasePath,
  buildOverridesPath,
  buildReleaseDetailsPath,
  buildWorkloadConfigPath,
  buildOverridesPathWithTab,
  buildWorkflowRunPath,
  buildWorkflowConfigPath,
  buildCreateComponentPath,
  buildWorkflowListPath,
} from './pathBuilders';

const entity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'api-service', namespace: 'my-org' },
};

const entityNoNs: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'System',
  metadata: { name: 'my-project' },
};

describe('buildEntityPath', () => {
  it('builds path with namespace', () => {
    expect(buildEntityPath(entity)).toBe(
      '/catalog/my-org/component/api-service',
    );
  });

  it('defaults to "default" namespace', () => {
    expect(buildEntityPath(entityNoNs)).toBe(
      '/catalog/default/system/my-project',
    );
  });

  it('lowercases kind', () => {
    expect(buildEntityPath(entity)).toContain('/component/');
  });
});

describe('base path builders', () => {
  it('buildEnvironmentsBasePath', () => {
    expect(buildEnvironmentsBasePath(entity)).toBe(
      '/catalog/my-org/component/api-service/environments',
    );
  });

  it('buildWorkflowsBasePath', () => {
    expect(buildWorkflowsBasePath(entity)).toBe(
      '/catalog/my-org/component/api-service/workflows',
    );
  });

  it('buildRuntimeLogsBasePath', () => {
    expect(buildRuntimeLogsBasePath(entity)).toBe(
      '/catalog/my-org/component/api-service/runtime-logs',
    );
  });
});

describe('environment paths', () => {
  const basePath = '/catalog/ns/component/svc/environments';

  it('buildOverridesPath without pending action', () => {
    expect(buildOverridesPath(basePath, 'Production')).toBe(
      `${basePath}/overrides/production`,
    );
  });

  it('buildOverridesPath with deploy action', () => {
    const url = buildOverridesPath(basePath, 'dev', {
      type: 'deploy',
      releaseName: 'rel-1',
      targetEnvironment: 'dev',
    });
    expect(url).toContain('/overrides/dev?');
    expect(url).toContain('action=deploy');
    expect(url).toContain('release=rel-1');
    expect(url).toContain('target=dev');
  });

  it('buildOverridesPath with promote action includes source', () => {
    const url = buildOverridesPath(basePath, 'staging', {
      type: 'promote',
      releaseName: 'rel-1',
      sourceEnvironment: 'dev',
      targetEnvironment: 'staging',
    });
    expect(url).toContain('source=dev');
  });

  it('buildOverridesPath encodes env name', () => {
    const url = buildOverridesPath(basePath, 'My Env');
    expect(url).toContain('/overrides/my%20env');
  });

  it('buildReleaseDetailsPath', () => {
    expect(buildReleaseDetailsPath(basePath, 'Dev')).toBe(
      `${basePath}/release/dev`,
    );
  });

  it('buildWorkloadConfigPath', () => {
    expect(buildWorkloadConfigPath(basePath)).toBe(
      `${basePath}/workload-config`,
    );
  });

  it('buildOverridesPathWithTab', () => {
    const url = buildOverridesPathWithTab(basePath, 'dev', 'env-vars');
    expect(url).toBe(`${basePath}/overrides/dev?tab=env-vars`);
  });
});

describe('workflow paths', () => {
  const basePath = '/catalog/ns/component/svc/workflows';

  it('buildWorkflowRunPath without tab', () => {
    expect(buildWorkflowRunPath(basePath, 'run-001')).toBe(
      `${basePath}/run/run-001`,
    );
  });

  it('buildWorkflowRunPath with logs tab (default, no query)', () => {
    expect(buildWorkflowRunPath(basePath, 'run-001', 'logs')).toBe(
      `${basePath}/run/run-001`,
    );
  });

  it('buildWorkflowRunPath with non-default tab', () => {
    expect(buildWorkflowRunPath(basePath, 'run-001', 'events')).toBe(
      `${basePath}/run/run-001?tab=events`,
    );
  });

  it('buildWorkflowRunPath encodes run ID', () => {
    expect(buildWorkflowRunPath(basePath, 'run/001')).toContain(
      '/run/run%2F001',
    );
  });

  it('buildWorkflowConfigPath', () => {
    expect(buildWorkflowConfigPath(basePath)).toBe(`${basePath}/config`);
  });

  it('buildWorkflowListPath without tab', () => {
    expect(buildWorkflowListPath(basePath)).toBe(basePath);
  });

  it('buildWorkflowListPath with runs tab (default, no query)', () => {
    expect(buildWorkflowListPath(basePath, 'runs')).toBe(basePath);
  });

  it('buildWorkflowListPath with configurations tab', () => {
    expect(buildWorkflowListPath(basePath, 'configurations')).toBe(
      `${basePath}?tab=configurations`,
    );
  });
});

describe('buildCreateComponentPath', () => {
  it('builds scaffolder path with project and namespace filters', () => {
    const url = buildCreateComponentPath('my-project', ['org-ns']);

    expect(url).toContain('/create?');
    expect(url).toContain('view=components');
    expect(url).toContain('filters%5Btype%5D=component');
    expect(url).toContain('filters%5Bnamespace%5D=org-ns');
    expect(url).toContain('project=my-project');
    expect(url).toContain('namespace=org-ns');
  });

  it('supports multiple namespaces', () => {
    const url = buildCreateComponentPath('proj', ['ns1', 'ns2']);

    // Should have two namespace filter entries
    const params = new URLSearchParams(url.split('?')[1]);
    const nsFilters = params.getAll('filters[namespace]');
    expect(nsFilters).toEqual(['ns1', 'ns2']);
    // First namespace set as default
    expect(params.get('namespace')).toBe('ns1');
  });

  it('handles empty namespaces', () => {
    const url = buildCreateComponentPath('proj', []);
    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('namespace')).toBeNull();
    expect(params.getAll('filters[namespace]')).toEqual([]);
  });
});
