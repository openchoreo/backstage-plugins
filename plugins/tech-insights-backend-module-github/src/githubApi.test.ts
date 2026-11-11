import { ConfigReader } from '@backstage/config';
import { ScmIntegrations } from '@backstage/integration';
import {
  createGithubApi,
  GithubRateLimitError,
  isRateLimited,
} from './githubApi';
import type { GithubRepository } from './repository';

describe('createGithubApi', () => {
  const integrations = ScmIntegrations.fromConfig(
    new ConfigReader({
      integrations: { github: [{ host: 'github.com', token: 'test' }] },
    }),
  );
  let api: ReturnType<typeof createGithubApi>;
  beforeEach(() => {
    api = createGithubApi(integrations);
  });
  const repository: GithubRepository = {
    host: 'github.com',
    owner: 'org',
    name: 'repo',
    url: 'https://github.com/org/repo',
    apiBaseUrl: 'https://api.github.com',
  };

  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['a 429', 429, {}, {}],
    [
      'a 403 with an exhausted primary limit',
      403,
      { 'x-ratelimit-remaining': '0' },
      { message: 'API rate limit exceeded' },
    ],
    [
      'a 403 naming the secondary rate limit',
      403,
      {},
      { message: 'You have exceeded a secondary rate limit.' },
    ],
  ])('rejects %s as a rate limit', async (_label, status, headers, body) => {
    jest
      .spyOn(global, 'fetch')
      .mockImplementation(
        async () => new Response(JSON.stringify(body), { status, headers }),
      );
    await expect(api.getRepo(repository)).rejects.toBeInstanceOf(
      GithubRateLimitError,
    );
  });

  it('returns a 403 that is not a rate limit', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify({ message: 'Resource not accessible' }), {
          status: 403,
        }),
    );
    await expect(api.getRepo(repository)).resolves.toEqual({
      status: 403,
      body: { message: 'Resource not accessible' },
    });
  });

  it('requests a repository path once for the life of the api', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation(
        async () => new Response(JSON.stringify({}), { status: 200 }),
      );
    await api.getRepo(repository, '/branches/main');
    await api.getRepo({ ...repository }, '/branches/main');
    await api.getRepo(repository, '/branches/dev');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('asks again after a server error', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response('{}', { status: 502 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    await expect(api.getRepo(repository)).resolves.toMatchObject({
      status: 502,
    });
    await expect(api.getRepo(repository)).resolves.toMatchObject({
      status: 200,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up on a request that takes too long, and tries it again next time', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(init.signal!.reason),
          );
        }),
    );
    const slowApi = createGithubApi(integrations, { timeoutMs: 10 });
    await expect(slowApi.getRepo(repository)).rejects.toThrow();
    await expect(slowApi.getRepo(repository)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('isRateLimited', () => {
  it.each([
    ['a 429', 429, {}],
    ['an exhausted primary limit', 403, { 'x-ratelimit-remaining': '0' }],
    [
      'a secondary limit',
      403,
      { 'retry-after': '60', 'x-ratelimit-remaining': '4321' },
    ],
  ])('treats %s as a rate limit', (_label, status, headers) => {
    expect(isRateLimited(status, new Headers(headers))).toBe(true);
  });

  it.each([
    ['a 403 without rate-limit headers', 403, {}],
    ['a 403 with quota left', 403, { 'x-ratelimit-remaining': '4321' }],
    ['a 404', 404, { 'x-ratelimit-remaining': '0' }],
  ])('treats %s as an ordinary response', (_label, status, headers) => {
    expect(isRateLimited(status, new Headers(headers))).toBe(false);
  });
});
