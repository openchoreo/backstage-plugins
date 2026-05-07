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
