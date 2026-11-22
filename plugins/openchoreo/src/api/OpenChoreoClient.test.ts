import { OpenChoreoClient } from './OpenChoreoClient';
import type { CreateSecretRequest } from './OpenChoreoClientApi';

const BASE_URL = 'http://backend/api/openchoreo';

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeNoContentResponse(): Response {
  return new Response(null, { status: 204 });
}

const BASE_ENTITY = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'test-project',
    namespace: 'default',
    annotations: {
      'openchoreo.io/namespace': 'test-ns',
      'openchoreo.io/component': 'test-component',
      'openchoreo.io/project': 'test-project',
    },
  },
  spec: { type: 'service' },
};

describe('OpenChoreoClient — cell diagram', () => {
  const fetchMock = jest.fn();
  const discovery = { getBaseUrl: jest.fn().mockResolvedValue(BASE_URL) };
  const fetchApi = { fetch: fetchMock };
  let client: OpenChoreoClient;

  beforeEach(() => {
    jest.clearAllMocks();
    discovery.getBaseUrl.mockResolvedValue(BASE_URL);
    client = new OpenChoreoClient(discovery as any, fetchApi as any);
  });

  describe('getCellDiagramInfo', () => {
    it('includes optional params when provided', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({}));

      await client.getCellDiagramInfo(BASE_ENTITY as any, {
        environmentName: 'dev',
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-01T01:00:00Z',
      });

      const [calledUrl] = fetchMock.mock.calls[0];
      expect(calledUrl).toContain('environmentName=dev');
      expect(calledUrl).toContain('startTime=');
      expect(calledUrl).toContain('endTime=');
    });

    it('omits optional params when not provided', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({}));

      await client.getCellDiagramInfo(BASE_ENTITY as any);

      const [calledUrl] = fetchMock.mock.calls[0];
      expect(calledUrl).not.toContain('environmentName');
      expect(calledUrl).not.toContain('startTime');
    });
  });

  describe('getNamespaceCellDiagramInfo', () => {
    it('requests /namespace-cell-diagram with the namespace name', async () => {
      fetchMock.mockResolvedValueOnce(
        makeJsonResponse({ id: 'test-ns', projects: [] }),
      );

      const result = await client.getNamespaceCellDiagramInfo('test-ns');

      const [calledUrl] = fetchMock.mock.calls[0];
      expect(calledUrl).toContain('/namespace-cell-diagram');
      expect(calledUrl).toContain('namespaceName=test-ns');
      expect(result).toEqual({ id: 'test-ns', projects: [] });
    });

    it('returns undefined without fetching when no namespace is given', async () => {
      const result = await client.getNamespaceCellDiagramInfo('');

      expect(result).toBeUndefined();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('rolloutRestartReleaseBinding', () => {
    it('POSTs to /rollout-restart-binding with entity metadata and bindingName', async () => {
      const result = { status: 'restarted' };
      fetchMock.mockResolvedValueOnce(makeJsonResponse(result));

      const response = await client.rolloutRestartReleaseBinding(
        BASE_ENTITY as any,
        'my-binding',
      );

      expect(response).toEqual(result);
      const [calledUrl, opts] = fetchMock.mock.calls[0];
      expect(calledUrl).toContain('/rollout-restart-binding');
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body);
      expect(body.bindingName).toBe('my-binding');
      expect(body.componentName).toBe('test-component');
      expect(body.projectName).toBe('test-project');
      expect(body.namespaceName).toBe('test-ns');
    });
  });
});

describe('OpenChoreoClient — secrets', () => {
  const fetchMock = jest.fn();
  const discovery = { getBaseUrl: jest.fn().mockResolvedValue(BASE_URL) };
  const fetchApi = { fetch: fetchMock };

  let client: OpenChoreoClient;

  beforeEach(() => {
    jest.clearAllMocks();
    discovery.getBaseUrl.mockResolvedValue(BASE_URL);
    client = new OpenChoreoClient(discovery as any, fetchApi as any);
  });

  describe('listSecrets', () => {
    it('GETs /secrets with namespaceName and returns the parsed body', async () => {
      const body = {
        items: [{ name: 's1' }],
        totalCount: 1,
        page: 1,
        pageSize: 100,
      };
      fetchMock.mockResolvedValueOnce(makeJsonResponse(body));

      const result = await client.listSecrets('ns');

      expect(result).toEqual(body);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [calledUrl, opts] = fetchMock.mock.calls[0];
      expect(calledUrl).toBe(`${BASE_URL}/secrets?namespaceName=ns`);
      expect(opts.method).toBe('GET');
      expect(opts.body).toBeUndefined();
    });

    it('throws ResponseError on non-2xx', async () => {
      fetchMock.mockResolvedValueOnce(
        makeJsonResponse({ error: { message: 'forbidden' } }, 403),
      );

      await expect(client.listSecrets('ns')).rejects.toMatchObject({
        statusCode: 403,
      });
    });
  });

  describe('getSecret', () => {
    it('GETs /secrets/:name with namespaceName and url-encodes the name', async () => {
      const body = { name: 'a/b', namespace: 'ns', keys: ['k'] };
      fetchMock.mockResolvedValueOnce(makeJsonResponse(body));

      const result = await client.getSecret('ns', 'a/b');

      expect(result).toEqual(body);
      const [calledUrl, opts] = fetchMock.mock.calls[0];
      expect(calledUrl).toBe(
        `${BASE_URL}/secrets/${encodeURIComponent('a/b')}?namespaceName=ns`,
      );
      expect(opts.method).toBe('GET');
    });
  });

  describe('createSecret', () => {
    it('POSTs /secrets with the request body and JSON content-type', async () => {
      const created = { name: 's1', namespace: 'ns', keys: ['k'] };
      fetchMock.mockResolvedValueOnce(makeJsonResponse(created, 201));

      const request: CreateSecretRequest = {
        secretName: 's1',
        secretType: 'Opaque',
        targetPlane: { kind: 'DataPlane', name: 'dp' },
        data: { k: 'v' },
      };
      const result = await client.createSecret('ns', request);

      expect(result).toEqual(created);
      const [calledUrl, opts] = fetchMock.mock.calls[0];
      expect(calledUrl).toBe(`${BASE_URL}/secrets?namespaceName=ns`);
      expect(opts.method).toBe('POST');
      expect(opts.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(JSON.parse(opts.body)).toEqual(request);
    });
  });

  describe('deleteSecret', () => {
    it('DELETEs /secrets/:name and resolves on 204', async () => {
      fetchMock.mockResolvedValueOnce(makeNoContentResponse());

      await expect(client.deleteSecret('ns', 's1')).resolves.toBeUndefined();

      const [calledUrl, opts] = fetchMock.mock.calls[0];
      expect(calledUrl).toBe(`${BASE_URL}/secrets/s1?namespaceName=ns`);
      expect(opts.method).toBe('DELETE');
    });

    it('throws ResponseError on a non-2xx delete', async () => {
      fetchMock.mockResolvedValueOnce(
        makeJsonResponse({ error: { message: 'nope' } }, 404),
      );

      await expect(client.deleteSecret('ns', 's1')).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });
});

const RESOURCE_ENTITY = {
  apiVersion: 'backstage.io/v1',
  kind: 'Resource',
  metadata: {
    name: 'analytics-db',
    namespace: 'default',
    annotations: {
      'openchoreo.io/namespace': 'test-ns',
      'openchoreo.io/resource': 'analytics-db',
      'openchoreo.io/project': 'shop',
    },
  },
  spec: { type: 'database' },
};

describe('OpenChoreoClient — resource environment info', () => {
  const fetchMock = jest.fn();
  const discovery = { getBaseUrl: jest.fn().mockResolvedValue(BASE_URL) };
  const fetchApi = { fetch: fetchMock };
  let client: OpenChoreoClient;

  beforeEach(() => {
    jest.clearAllMocks();
    discovery.getBaseUrl.mockResolvedValue(BASE_URL);
    client = new OpenChoreoClient(discovery as any, fetchApi as any);
  });

  it('GETs /resource-environment-info with resource entity params', async () => {
    const payload = [
      { name: 'dev', latestRelease: 'analytics-db-abc' },
      { name: 'staging', latestRelease: 'analytics-db-abc' },
    ];
    fetchMock.mockResolvedValueOnce(makeJsonResponse(payload));

    const result = await client.fetchResourceEnvironmentInfo(
      RESOURCE_ENTITY as any,
    );

    expect(result).toEqual(payload);
    const [calledUrl, opts] = fetchMock.mock.calls[0];
    expect(calledUrl).toContain('/resource-environment-info');
    expect(calledUrl).toContain('resourceName=analytics-db');
    expect(calledUrl).toContain('projectName=shop');
    expect(calledUrl).toContain('namespaceName=test-ns');
    expect(opts.method ?? 'GET').toBe('GET');
  });

  it('throws when required annotations are missing on the entity', async () => {
    const bareEntity = {
      apiVersion: 'backstage.io/v1',
      kind: 'Resource',
      metadata: { name: 'x', namespace: 'default', annotations: {} },
      spec: {},
    };

    await expect(
      client.fetchResourceEnvironmentInfo(bareEntity as any),
    ).rejects.toThrow(/Missing required OpenChoreo annotations/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('OpenChoreoClient — updateResourceReleaseBinding', () => {
  const fetchMock = jest.fn();
  const discovery = { getBaseUrl: jest.fn().mockResolvedValue(BASE_URL) };
  const fetchApi = { fetch: fetchMock };
  let client: OpenChoreoClient;

  beforeEach(() => {
    jest.clearAllMocks();
    discovery.getBaseUrl.mockResolvedValue(BASE_URL);
    client = new OpenChoreoClient(discovery as any, fetchApi as any);
  });

  it('PUTs to /update-resource-release-binding with resource entity metadata + new release', async () => {
    fetchMock.mockResolvedValueOnce(makeJsonResponse({ ok: true }));

    await client.updateResourceReleaseBinding(RESOURCE_ENTITY as any, 'dev', {
      resourceRelease: 'analytics-db-new',
    });

    const [calledUrl, opts] = fetchMock.mock.calls[0];
    expect(calledUrl).toContain('/update-resource-release-binding');
    expect(opts.method).toBe('PUT');
    const body = JSON.parse(opts.body);
    expect(body).toEqual({
      resourceName: 'analytics-db',
      projectName: 'shop',
      namespaceName: 'test-ns',
      environment: 'dev',
      releaseName: 'analytics-db-new',
    });
  });

  it('forwards optional retainPolicy and resourceTypeEnvironmentConfigs', async () => {
    fetchMock.mockResolvedValueOnce(makeJsonResponse({ ok: true }));

    await client.updateResourceReleaseBinding(RESOURCE_ENTITY as any, 'dev', {
      resourceRelease: 'rel-1',
      retainPolicy: 'Retain',
      resourceTypeEnvironmentConfigs: { replicas: 3 },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.retainPolicy).toBe('Retain');
    expect(body.resourceTypeEnvironmentConfigs).toEqual({ replicas: 3 });
  });
});

describe('OpenChoreoClient — deleteResourceReleaseBinding', () => {
  const fetchMock = jest.fn();
  const discovery = { getBaseUrl: jest.fn().mockResolvedValue(BASE_URL) };
  const fetchApi = { fetch: fetchMock };
  let client: OpenChoreoClient;

  beforeEach(() => {
    jest.clearAllMocks();
    discovery.getBaseUrl.mockResolvedValue(BASE_URL);
    client = new OpenChoreoClient(discovery as any, fetchApi as any);
  });

  it('DELETEs /delete-resource-release-binding with resource entity metadata', async () => {
    fetchMock.mockResolvedValueOnce(makeJsonResponse({ success: true }));

    await client.deleteResourceReleaseBinding(RESOURCE_ENTITY as any, 'dev');

    const [calledUrl, opts] = fetchMock.mock.calls[0];
    expect(calledUrl).toContain('/delete-resource-release-binding');
    expect(opts.method).toBe('DELETE');
    const body = JSON.parse(opts.body);
    expect(body).toEqual({
      resourceName: 'analytics-db',
      projectName: 'shop',
      namespaceName: 'test-ns',
      environment: 'dev',
    });
  });
});

const ENDPOINT_ENTITY = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Endpoint',
  metadata: {
    name: 'orders-api',
    namespace: 'test-ns',
    annotations: {
      'openchoreo.io/namespace': 'test-ns',
      'openchoreo.io/endpoint': 'orders-api',
      'openchoreo.io/project': 'shop',
      'openchoreo.io/endpointtype': 'http-route',
      'openchoreo.io/endpointtype-kind': 'ClusterEndpointType',
    },
  },
  spec: { type: 'http-route' },
};

describe('OpenChoreoClient — endpoints', () => {
  const fetchMock = jest.fn();
  const discovery = { getBaseUrl: jest.fn().mockResolvedValue(BASE_URL) };
  const fetchApi = { fetch: fetchMock };
  let client: OpenChoreoClient;

  beforeEach(() => {
    jest.clearAllMocks();
    discovery.getBaseUrl.mockResolvedValue(BASE_URL);
    client = new OpenChoreoClient(discovery as any, fetchApi as any);
  });

  it('GETs /endpoint-environment-info with the endpoint coordinates', async () => {
    const payload = [{ name: 'dev', latestRelease: 'orders-api-abc' }];
    fetchMock.mockResolvedValueOnce(makeJsonResponse(payload));

    const result = await client.fetchEndpointEnvironmentInfo(
      ENDPOINT_ENTITY as any,
    );

    expect(result).toEqual(payload);
    const [calledUrl] = fetchMock.mock.calls[0];
    expect(calledUrl).toContain('/endpoint-environment-info');
    expect(calledUrl).toContain('endpointName=orders-api');
    expect(calledUrl).toContain('projectName=shop');
    expect(calledUrl).toContain('namespaceName=test-ns');
  });

  it('throws when the Endpoint annotations are missing', async () => {
    await expect(
      client.fetchEndpointEnvironmentInfo({
        ...ENDPOINT_ENTITY,
        metadata: { name: 'x', annotations: {} },
      } as any),
    ).rejects.toThrow(/Missing required OpenChoreo annotations/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('PUTs only the provided binding fields', async () => {
    fetchMock.mockResolvedValueOnce(makeJsonResponse({}));

    await client.updateEndpointReleaseBinding(ENDPOINT_ENTITY as any, 'dev', {
      endpointTypeEnvironmentConfigs: { hostname: 'orders.example.com' },
    });

    const [calledUrl, opts] = fetchMock.mock.calls[0];
    expect(calledUrl).toContain('/update-endpoint-release-binding');
    expect(opts.method).toBe('PUT');
    expect(JSON.parse(opts.body)).toEqual({
      endpointName: 'orders-api',
      projectName: 'shop',
      namespaceName: 'test-ns',
      environment: 'dev',
      endpointTypeEnvironmentConfigs: { hostname: 'orders.example.com' },
    });
  });

  it('sends the release as releaseName when promoting', async () => {
    fetchMock.mockResolvedValueOnce(makeJsonResponse({}));

    await client.updateEndpointReleaseBinding(ENDPOINT_ENTITY as any, 'prod', {
      endpointRelease: 'orders-api-abc',
    });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      environment: 'prod',
      releaseName: 'orders-api-abc',
    });
  });

  it('DELETEs /delete-endpoint-release-binding', async () => {
    fetchMock.mockResolvedValueOnce(makeJsonResponse({ success: true }));

    await client.deleteEndpointReleaseBinding(ENDPOINT_ENTITY as any, 'dev');

    const [calledUrl, opts] = fetchMock.mock.calls[0];
    expect(calledUrl).toContain('/delete-endpoint-release-binding');
    expect(opts.method).toBe('DELETE');
    expect(JSON.parse(opts.body)).toEqual({
      endpointName: 'orders-api',
      projectName: 'shop',
      namespaceName: 'test-ns',
      environment: 'dev',
    });
  });
});

// A Project entity is catalog kind System: the project name is the entity
// name and the OpenChoreo namespace is annotated.
const PROJECT_ENTITY = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'System',
  metadata: {
    name: 'shop',
    namespace: 'default',
    annotations: {
      'openchoreo.io/namespace': 'test-ns',
      'openchoreo.io/project-type': 'web-application',
      'openchoreo.io/project-type-kind': 'ClusterProjectType',
    },
  },
  spec: {},
};

describe('OpenChoreoClient — project environment info', () => {
  const fetchMock = jest.fn();
  const discovery = { getBaseUrl: jest.fn().mockResolvedValue(BASE_URL) };
  const fetchApi = { fetch: fetchMock };
  let client: OpenChoreoClient;

  beforeEach(() => {
    jest.clearAllMocks();
    discovery.getBaseUrl.mockResolvedValue(BASE_URL);
    client = new OpenChoreoClient(discovery as any, fetchApi as any);
  });

  it('GETs /project-environment-info with project entity params', async () => {
    const payload = [
      { name: 'dev', latestRelease: 'shop-abc' },
      { name: 'staging', latestRelease: 'shop-abc' },
    ];
    fetchMock.mockResolvedValueOnce(makeJsonResponse(payload));

    const result = await client.fetchProjectEnvironmentInfo(
      PROJECT_ENTITY as any,
    );

    expect(result).toEqual(payload);
    const [calledUrl, opts] = fetchMock.mock.calls[0];
    expect(calledUrl).toContain('/project-environment-info');
    expect(calledUrl).toContain('projectName=shop');
    expect(calledUrl).toContain('namespaceName=test-ns');
    expect(opts.method ?? 'GET').toBe('GET');
  });

  it('throws when the namespace annotation is missing on the entity', async () => {
    const bareEntity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'System',
      metadata: { name: 'shop', namespace: 'default', annotations: {} },
      spec: {},
    };

    await expect(
      client.fetchProjectEnvironmentInfo(bareEntity as any),
    ).rejects.toThrow(/Missing required OpenChoreo annotations/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('OpenChoreoClient — fetchProjectReleaseBindings', () => {
  const fetchMock = jest.fn();
  const discovery = { getBaseUrl: jest.fn().mockResolvedValue(BASE_URL) };
  const fetchApi = { fetch: fetchMock };
  let client: OpenChoreoClient;

  beforeEach(() => {
    jest.clearAllMocks();
    discovery.getBaseUrl.mockResolvedValue(BASE_URL);
    client = new OpenChoreoClient(discovery as any, fetchApi as any);
  });

  it('GETs /project-release-bindings with project entity params', async () => {
    const payload = { success: true, data: { items: [] } };
    fetchMock.mockResolvedValueOnce(makeJsonResponse(payload));

    const result = await client.fetchProjectReleaseBindings(
      PROJECT_ENTITY as any,
    );

    expect(result).toEqual(payload);
    const [calledUrl, opts] = fetchMock.mock.calls[0];
    expect(calledUrl).toContain('/project-release-bindings');
    expect(calledUrl).toContain('projectName=shop');
    expect(calledUrl).toContain('namespaceName=test-ns');
    expect(opts.method ?? 'GET').toBe('GET');
  });
});

describe('OpenChoreoClient — updateProjectReleaseBinding', () => {
  const fetchMock = jest.fn();
  const discovery = { getBaseUrl: jest.fn().mockResolvedValue(BASE_URL) };
  const fetchApi = { fetch: fetchMock };
  let client: OpenChoreoClient;

  beforeEach(() => {
    jest.clearAllMocks();
    discovery.getBaseUrl.mockResolvedValue(BASE_URL);
    client = new OpenChoreoClient(discovery as any, fetchApi as any);
  });

  it('PUTs to /update-project-release-binding with project metadata + new release', async () => {
    fetchMock.mockResolvedValueOnce(makeJsonResponse({ ok: true }));

    await client.updateProjectReleaseBinding(PROJECT_ENTITY as any, 'dev', {
      projectRelease: 'shop-new',
    });

    const [calledUrl, opts] = fetchMock.mock.calls[0];
    expect(calledUrl).toContain('/update-project-release-binding');
    expect(opts.method).toBe('PUT');
    const body = JSON.parse(opts.body);
    expect(body).toEqual({
      projectName: 'shop',
      namespaceName: 'test-ns',
      environment: 'dev',
      releaseName: 'shop-new',
    });
  });

  it('forwards optional environmentConfigs', async () => {
    fetchMock.mockResolvedValueOnce(makeJsonResponse({ ok: true }));

    await client.updateProjectReleaseBinding(PROJECT_ENTITY as any, 'dev', {
      projectRelease: 'shop-new',
      environmentConfigs: { replicas: 3 },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.environmentConfigs).toEqual({ replicas: 3 });
  });
});

describe('OpenChoreoClient — fetchProjectReleaseSchema', () => {
  const fetchMock = jest.fn();
  const discovery = { getBaseUrl: jest.fn().mockResolvedValue(BASE_URL) };
  const fetchApi = { fetch: fetchMock };
  let client: OpenChoreoClient;

  beforeEach(() => {
    jest.clearAllMocks();
    discovery.getBaseUrl.mockResolvedValue(BASE_URL);
    client = new OpenChoreoClient(discovery as any, fetchApi as any);
  });

  it('GETs /project-release-schema with namespace, release and section', async () => {
    fetchMock.mockResolvedValueOnce(
      makeJsonResponse({ success: true, data: { type: 'object' } }),
    );

    const result = await client.fetchProjectReleaseSchema(
      'test-ns',
      'shop-abc',
      'environmentConfigs',
    );

    expect(result).toEqual({ success: true, data: { type: 'object' } });
    const [calledUrl, opts] = fetchMock.mock.calls[0];
    expect(calledUrl).toContain('/project-release-schema');
    expect(calledUrl).toContain('namespaceName=test-ns');
    expect(calledUrl).toContain('releaseName=shop-abc');
    expect(calledUrl).toContain('section=environmentConfigs');
    expect(opts.method ?? 'GET').toBe('GET');
  });
});

describe('OpenChoreoClient — platform version', () => {
  const fetchMock = jest.fn();
  const discovery = { getBaseUrl: jest.fn().mockResolvedValue(BASE_URL) };
  const fetchApi = { fetch: fetchMock };
  let client: OpenChoreoClient;

  beforeEach(() => {
    jest.clearAllMocks();
    discovery.getBaseUrl.mockResolvedValue(BASE_URL);
    client = new OpenChoreoClient(discovery as any, fetchApi as any);
  });

  it('GETs /platform-version and returns the version info', async () => {
    const versionInfo = {
      name: 'openchoreo-api',
      version: 'v1.2.0',
      gitRevision: 'abc12345',
      buildTime: '2025-01-06T10:00:00Z',
      goOS: 'linux',
      goArch: 'amd64',
      goVersion: 'go1.24.2',
    };
    fetchMock.mockResolvedValueOnce(makeJsonResponse(versionInfo));

    const result = await client.getPlatformVersion();

    expect(result).toEqual(versionInfo);
    const [calledUrl, opts] = fetchMock.mock.calls[0];
    expect(calledUrl).toContain('/platform-version');
    expect(opts.method ?? 'GET').toBe('GET');
  });

  it('throws on a non-2xx response', async () => {
    fetchMock.mockResolvedValueOnce(
      makeJsonResponse({ error: 'unavailable' }, 502),
    );

    await expect(client.getPlatformVersion()).rejects.toThrow();
  });
});

describe('OpenChoreoClient — resource release binding revisions', () => {
  const fetchMock = jest.fn();
  const discovery = { getBaseUrl: jest.fn().mockResolvedValue(BASE_URL) };
  const fetchApi = { fetch: fetchMock };
  let client: OpenChoreoClient;

  beforeEach(() => {
    jest.clearAllMocks();
    discovery.getBaseUrl.mockResolvedValue(BASE_URL);
    client = new OpenChoreoClient(discovery as any, fetchApi as any);
  });

  it('GETs /resource-release-binding-revisions for the resource and environment', async () => {
    const revisions = [{ metadata: { name: 'analytics-db-dev-r1' } }];
    fetchMock.mockResolvedValueOnce(makeJsonResponse(revisions));

    const result = await client.listResourceReleaseBindingRevisions(
      RESOURCE_ENTITY as any,
      'dev',
    );

    expect(result).toEqual(revisions);
    const [calledUrl, opts] = fetchMock.mock.calls[0];
    expect(calledUrl).toContain('/resource-release-binding-revisions');
    expect(calledUrl).toContain('resourceName=analytics-db');
    expect(calledUrl).toContain('namespaceName=test-ns');
    expect(calledUrl).toContain('environment=dev');
    expect(opts.method ?? 'GET').toBe('GET');
  });

  it('POSTs /rollback-resource-release-binding with the binding and revision', async () => {
    const preview = { revision: 2, dryRun: true, changes: [], warnings: [] };
    fetchMock.mockResolvedValueOnce(makeJsonResponse(preview));

    const result = await client.rollbackResourceReleaseBinding(
      RESOURCE_ENTITY as any,
      'analytics-db-dev',
      1,
      true,
    );

    expect(result).toEqual(preview);
    const [calledUrl, opts] = fetchMock.mock.calls[0];
    expect(calledUrl).toContain('/rollback-resource-release-binding');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({
      namespaceName: 'test-ns',
      bindingName: 'analytics-db-dev',
      revision: 1,
      dryRun: true,
    });
  });

  it('POSTs /delete-resource-release-binding-revision with the binding and revision name', async () => {
    const result = {
      revisionName: 'analytics-db-dev-r1',
      revision: 1,
      dryRun: false,
    };
    fetchMock.mockResolvedValueOnce(makeJsonResponse(result));

    await expect(
      client.deleteResourceReleaseBindingRevision(
        RESOURCE_ENTITY as any,
        'analytics-db-dev',
        'analytics-db-dev-r1',
        false,
      ),
    ).resolves.toEqual(result);
    const [calledUrl, opts] = fetchMock.mock.calls[0];
    expect(calledUrl).toContain('/delete-resource-release-binding-revision');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({
      namespaceName: 'test-ns',
      bindingName: 'analytics-db-dev',
      revisionName: 'analytics-db-dev-r1',
      dryRun: false,
    });
  });

  it('POSTs /delete-release-binding-revision for a component binding', async () => {
    fetchMock.mockResolvedValueOnce(makeJsonResponse({ revision: 2 }));

    await client.deleteReleaseBindingRevision(
      BASE_ENTITY as any,
      'api-dev',
      'api-dev-r2',
      true,
    );
    const [calledUrl, opts] = fetchMock.mock.calls[0];
    expect(calledUrl).toContain('/delete-release-binding-revision');
    expect(JSON.parse(opts.body)).toEqual(
      expect.objectContaining({
        bindingName: 'api-dev',
        revisionName: 'api-dev-r2',
        dryRun: true,
      }),
    );
  });

  it.each([
    ['component', BASE_ENTITY, 'api-dev'],
    ['resource', RESOURCE_ENTITY, 'analytics-db-dev'],
  ] as const)(
    'GETs /binding-revision-history-limit for a %s binding',
    async (kind, entity, bindingName) => {
      const limit = { bindingLimit: 5, environmentLimit: 10 };
      fetchMock.mockResolvedValueOnce(makeJsonResponse(limit));

      await expect(
        client.getBindingRevisionHistoryLimit(entity as any, kind, bindingName),
      ).resolves.toEqual(limit);
      const [calledUrl, opts] = fetchMock.mock.calls[0];
      const url = new URL(calledUrl);
      expect(url.pathname).toContain('/binding-revision-history-limit');
      expect(Object.fromEntries(url.searchParams)).toEqual({
        namespaceName: 'test-ns',
        bindingName,
        kind,
      });
      expect(opts.method).toBe('GET');
    },
  );

  it.each([
    ['component', BASE_ENTITY, 'api-dev', 7],
    ['resource', RESOURCE_ENTITY, 'analytics-db-dev', 0],
    ['component', BASE_ENTITY, 'api-dev', null],
  ] as const)(
    'PUTs /binding-revision-history-limit for a %s binding',
    async (kind, entity, bindingName, limit) => {
      const saved = { bindingLimit: limit, environmentLimit: null };
      fetchMock.mockResolvedValueOnce(makeJsonResponse(saved));

      await expect(
        client.setBindingRevisionHistoryLimit(
          entity as any,
          kind,
          bindingName,
          limit,
        ),
      ).resolves.toEqual(saved);
      const [calledUrl, opts] = fetchMock.mock.calls[0];
      expect(calledUrl).toContain('/binding-revision-history-limit');
      expect(opts.method).toBe('PUT');
      // null is sent, not dropped: it clears the binding's own limit.
      expect(JSON.parse(opts.body)).toEqual({
        namespaceName: 'test-ns',
        bindingName,
        kind,
        limit,
      });
    },
  );
});
