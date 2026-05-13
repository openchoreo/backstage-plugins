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

  describe('getCellDiagramEnvironments', () => {
    it('GETs /cell-diagram/environments with namespaceName', async () => {
      const envs = ['dev', 'prod'];
      fetchMock.mockResolvedValueOnce(makeJsonResponse(envs));

      const result = await client.getCellDiagramEnvironments(
        BASE_ENTITY as any,
      );

      expect(result).toEqual(envs);
      const [calledUrl] = fetchMock.mock.calls[0];
      expect(calledUrl).toContain('/cell-diagram/environments');
      expect(calledUrl).toContain('namespaceName=test-ns');
    });

    it('returns empty array when namespace annotation is missing', async () => {
      const entityNoNs = {
        ...BASE_ENTITY,
        metadata: { ...BASE_ENTITY.metadata, annotations: {} },
      };
      const result = await client.getCellDiagramEnvironments(entityNoNs as any);
      expect(result).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns empty array when fetch fails', async () => {
      fetchMock.mockResolvedValueOnce(
        makeJsonResponse({ error: { message: 'error' } }, 500),
      );
      const result = await client.getCellDiagramEnvironments(
        BASE_ENTITY as any,
      );
      expect(result).toEqual([]);
    });
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
