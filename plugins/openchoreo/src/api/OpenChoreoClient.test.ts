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
