import { ConfigReader } from '@backstage/config';
import type { Entity } from '@backstage/catalog-model';
import { mockServices } from '@backstage/backend-test-utils';
import type { FactRetrieverContext } from '@backstage-community/plugin-tech-insights-node';
import {
  cacheCursor,
  collectGithubFacts,
  type CollectionCursor,
} from './collectGithubFacts';
import { GithubRateLimitError } from './githubApi';

const mockGetEntities = jest.fn();
jest.mock('@backstage/catalog-client', () => ({
  CatalogClient: jest.fn().mockImplementation(() => ({
    getEntities: mockGetEntities,
  })),
}));

function component(name: string, slug?: string): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name,
      namespace: 'default',
      annotations: slug ? { 'github.com/project-slug': slug } : {},
    },
  };
}

function context(): FactRetrieverContext {
  return {
    config: new ConfigReader({}),
    discovery: mockServices.discovery(),
    auth: mockServices.auth(),
    logger: mockServices.logger.mock(),
    entityFilter: [{ kind: 'component' }],
  } as unknown as FactRetrieverContext;
}

function memoryCursor(initial?: string) {
  let value = initial;
  const cursor: CollectionCursor = {
    get: jest.fn(async () => value),
    set: jest.fn(async ref => {
      value = ref;
    }),
  };
  return { cursor, current: () => value };
}

const names = (facts: { entity: { name: string } }[]) =>
  facts.map(f => f.entity.name);

describe('cacheCursor', () => {
  const setup = () => {
    const cache = mockServices.cache.mock();
    const logger = mockServices.logger.mock();
    return {
      cache,
      logger,
      cursor: cacheCursor(cache, logger, 'retriever:key'),
    };
  };

  it('reads and stores the entity under the given key', async () => {
    const { cache, cursor } = setup();
    cache.get.mockResolvedValue('component:default/a');
    await expect(cursor.get()).resolves.toBe('component:default/a');
    expect(cache.get).toHaveBeenCalledWith('retriever:key');

    await cursor.set('component:default/b');
    expect(cache.set).toHaveBeenCalledWith(
      'retriever:key',
      'component:default/b',
      { ttl: { days: 30 } },
    );
  });

  it('forgets the entity when the run finished', async () => {
    const { cache, cursor } = setup();
    await cursor.set(undefined);
    expect(cache.delete).toHaveBeenCalledWith('retriever:key');
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('starts from the first entity when the cache cannot be read', async () => {
    const { cache, logger, cursor } = setup();
    cache.get.mockRejectedValue(new Error('cache down'));
    await expect(cursor.get()).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('cache down'),
    );
  });

  it('carries on when the cache cannot be written', async () => {
    const { cache, logger, cursor } = setup();
    cache.set.mockRejectedValue(new Error('cache down'));
    await expect(cursor.set('component:default/a')).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('cache down'),
    );
  });
});

describe('collectGithubFacts', () => {
  beforeEach(() => mockGetEntities.mockReset());

  it('resumes where a rate limit stopped the previous run', async () => {
    mockGetEntities.mockResolvedValue({
      items: [
        component('c', 'org/c'),
        component('a', 'org/a'),
        component('b', 'org/b'),
      ],
    });
    const { cursor, current } = memoryCursor();
    let limited = true;
    const collect = jest.fn(async ({ entity }: { entity: Entity }) => {
      if (entity.metadata.name === 'b' && limited) {
        throw new GithubRateLimitError(429);
      }
      return { githubIsArchived: false };
    });

    const first = await collectGithubFacts(context(), collect, { cursor });
    expect(names(first)).toEqual(['a']);
    expect(current()).toBe('component:default/b');

    limited = false;
    const second = await collectGithubFacts(context(), collect, { cursor });
    expect(names(second)).toEqual(['b', 'c', 'a']);
    expect(current()).toBeUndefined();
  });

  it('starts from the next entity when the cursor entity is gone', async () => {
    mockGetEntities.mockResolvedValue({
      items: [component('a', 'org/a'), component('c', 'org/c')],
    });
    const { cursor } = memoryCursor('component:default/b');

    const facts = await collectGithubFacts(
      context(),
      async () => ({ githubIsArchived: false }),
      { cursor },
    );
    expect(names(facts)).toEqual(['c', 'a']);
  });

  it('reports an entity without a repository as unresolved', async () => {
    mockGetEntities.mockResolvedValue({ items: [component('image-only')] });
    const facts = await collectGithubFacts(context(), jest.fn(), {
      unresolvedFacts: { githubRepositoryResolved: false },
    });
    expect(facts[0].facts).toEqual({ githubRepositoryResolved: false });
  });

  it('keeps going past an entity whose collection fails', async () => {
    mockGetEntities.mockResolvedValue({
      items: [component('a', 'org/a'), component('b', 'org/b')],
    });
    const facts = await collectGithubFacts(context(), async ({ entity }) => {
      if (entity.metadata.name === 'a') throw new Error('HTTP 500');
      return { githubIsArchived: false };
    });
    expect(names(facts)).toEqual(['b']);
  });
});
