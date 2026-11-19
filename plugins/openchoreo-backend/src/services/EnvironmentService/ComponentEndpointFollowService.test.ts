import { mockServices } from '@backstage/backend-test-utils';
import { NotFoundError } from '@backstage/errors';
import { createOkResponse } from '@openchoreo/test-utils';
import { ComponentEndpointFollowService } from './ComponentEndpointFollowService';

const mockGET = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(() => ({ GET: mockGET })),
  fetchAllPages: jest.fn((fetchPage: (cursor?: string) => Promise<any>) =>
    fetchPage(undefined).then((page: any) => page.items),
  ),
}));

const component = {
  componentName: 'orders',
  projectName: 'shop',
  namespaceName: 'acme',
};

function endpoint(
  name: string,
  overrides: {
    releaseLineName?: string;
    componentName?: string | null;
    autoDeploy?: boolean;
    latestRelease?: string | null;
  } = {},
) {
  return {
    metadata: { name },
    spec: {
      owner: {
        projectName: 'shop',
        ...(overrides.componentName !== null && {
          componentName: overrides.componentName ?? 'orders',
        }),
        ...(overrides.releaseLineName && {
          releaseLineName: overrides.releaseLineName,
        }),
      },
      autoDeploy: overrides.autoDeploy ?? false,
    },
    status:
      overrides.latestRelease === null
        ? {}
        : { latestRelease: { name: overrides.latestRelease ?? `${name}-r2` } },
  };
}

function binding(endpointName: string, environment: string, release: string) {
  return {
    metadata: { name: `${endpointName}-${environment}` },
    spec: {
      owner: { projectName: 'shop', endpointName },
      environment,
      endpointRelease: release,
    },
  };
}

/** Serves the Endpoints and their bindings, as the API lists them. */
function serve(
  endpoints: unknown[] | (() => unknown[]),
  bindings: ReturnType<typeof binding>[] = [],
) {
  mockGET.mockImplementation((path: string, options: any) => {
    if (path.endsWith('/endpoints')) {
      const items = typeof endpoints === 'function' ? endpoints() : endpoints;
      return Promise.resolve(createOkResponse({ items }));
    }
    if (path.endsWith('/endpointreleasebindings')) {
      const name = options.params.query.endpoint;
      return Promise.resolve(
        createOkResponse({
          items: bindings.filter(b => b.spec.owner.endpointName === name),
        }),
      );
    }
    if (path.endsWith('/releasebindings/{releaseBindingName}')) {
      return Promise.resolve(
        createOkResponse({ spec: { environment: 'staging' } }),
      );
    }
    throw new Error(`unexpected GET ${path}`);
  });
}

function fakeWriter() {
  return {
    updateEndpointReleaseBinding: jest.fn().mockResolvedValue({}),
    deleteEndpointReleaseBinding: jest.fn().mockResolvedValue({}),
  };
}

function createService(writer = fakeWriter()) {
  return {
    writer,
    service: new ComponentEndpointFollowService(
      mockServices.logger.mock(),
      'http://api',
      writer,
      { releaseWaitMs: 50, pollMs: 10 },
    ),
  };
}

describe('ComponentEndpointFollowService', () => {
  beforeEach(() => mockGET.mockReset());

  describe('follow', () => {
    it("binds the line's own Endpoints to their latest release on a deploy, leaving auto-deploying ones to the controller", async () => {
      serve([
        endpoint('orders-api'),
        endpoint('orders-auto', { autoDeploy: true }),
        endpoint('orders-canary-api', { releaseLineName: 'canary' }),
        endpoint('shared', { componentName: null }),
      ]);
      const { service, writer } = createService();

      const result = await service.follow(
        { ...component, environment: 'dev', action: 'deploy' },
        'token',
      );

      expect(writer.updateEndpointReleaseBinding).toHaveBeenCalledTimes(1);
      expect(writer.updateEndpointReleaseBinding).toHaveBeenCalledWith(
        {
          endpointName: 'orders-api',
          projectName: 'shop',
          namespaceName: 'acme',
          environment: 'dev',
          releaseName: 'orders-api-r2',
        },
        'token',
      );
      expect(result).toEqual({
        bound: [{ endpoint: 'orders-api', releaseName: 'orders-api-r2' }],
        removed: [],
        skipped: ['orders-auto'],
        failed: [],
      });
    });

    it('moves the release each Endpoint has in the source environment on a promote', async () => {
      serve(
        [endpoint('orders-api'), endpoint('orders-auto', { autoDeploy: true })],
        [binding('orders-api', 'dev', 'orders-api-r1')],
      );
      const { service } = createService();

      const result = await service.follow(
        {
          ...component,
          environment: 'staging',
          action: 'promote',
          sourceEnvironment: 'dev',
        },
        'token',
      );

      // Auto deploy covers only the first environment, so it's bound too.
      expect(result.bound).toEqual([
        { endpoint: 'orders-api', releaseName: 'orders-api-r1' },
        { endpoint: 'orders-auto', releaseName: 'orders-auto-r2' },
      ]);
    });

    it("follows only the promoted release line's Endpoints", async () => {
      serve([
        endpoint('orders-api'),
        endpoint('orders-canary-api', { releaseLineName: 'canary' }),
      ]);
      const { service } = createService();

      const result = await service.follow(
        {
          ...component,
          releaseLine: 'canary',
          environment: 'staging',
          action: 'promote',
          sourceEnvironment: 'dev',
        },
        'token',
      );

      expect(result.bound.map(b => b.endpoint)).toEqual(['orders-canary-api']);
    });

    it('waits briefly for a new Endpoint to get its first release', async () => {
      let calls = 0;
      serve(() => {
        calls += 1;
        return [
          endpoint('orders-api', {
            latestRelease: calls < 3 ? null : 'orders-api-r1',
          }),
        ];
      });
      const { service } = createService();

      const result = await service.follow(
        { ...component, environment: 'dev', action: 'deploy' },
        'token',
      );

      expect(result.bound).toEqual([
        { endpoint: 'orders-api', releaseName: 'orders-api-r1' },
      ]);
    });

    it('reports an Endpoint still without a release, and one that fails to bind, without throwing', async () => {
      serve([
        endpoint('orders-new', { latestRelease: null }),
        endpoint('orders-api'),
      ]);
      const writer = fakeWriter();
      writer.updateEndpointReleaseBinding.mockRejectedValue(
        new Error('forbidden'),
      );
      const { service } = createService(writer);

      const result = await service.follow(
        { ...component, environment: 'dev', action: 'deploy' },
        'token',
      );

      expect(result.bound).toEqual([]);
      expect(result.failed).toEqual([
        { endpoint: 'orders-new', reason: 'it has no release yet' },
        { endpoint: 'orders-api', reason: 'forbidden' },
      ]);
    });

    it('does nothing for a component that owns no Endpoints', async () => {
      serve([endpoint('shared', { componentName: 'other' })]);
      const { service, writer } = createService();

      const result = await service.follow(
        { ...component, environment: 'dev', action: 'deploy' },
        'token',
      );

      expect(writer.updateEndpointReleaseBinding).not.toHaveBeenCalled();
      expect(result).toEqual({
        bound: [],
        removed: [],
        skipped: [],
        failed: [],
      });
    });
  });

  describe('remove', () => {
    it("deletes the line's Endpoint bindings in the environment, skipping ones not bound there", async () => {
      serve([endpoint('orders-api'), endpoint('orders-web')]);
      const writer = fakeWriter();
      writer.deleteEndpointReleaseBinding
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new NotFoundError('no binding'));
      const { service } = createService(writer);

      const result = await service.remove(
        { ...component, environment: 'staging' },
        'token',
      );

      expect(writer.deleteEndpointReleaseBinding).toHaveBeenCalledWith(
        {
          endpointName: 'orders-api',
          projectName: 'shop',
          namespaceName: 'acme',
          environment: 'staging',
        },
        'token',
      );
      expect(result).toEqual({
        bound: [],
        removed: ['orders-api'],
        skipped: [],
        failed: [],
      });
    });

    it('reports an Endpoint whose binding could not be deleted', async () => {
      serve([endpoint('orders-api')]);
      const writer = fakeWriter();
      writer.deleteEndpointReleaseBinding.mockRejectedValue(new Error('boom'));
      const { service } = createService(writer);

      const result = await service.remove(
        { ...component, environment: 'staging' },
        'token',
      );

      expect(result.failed).toEqual([
        { endpoint: 'orders-api', reason: 'boom' },
      ]);
    });
  });

  it('reads the environment of a component binding', async () => {
    serve([]);
    const { service } = createService();

    await expect(
      service.bindingEnvironment('acme', 'orders-staging', 'token'),
    ).resolves.toBe('staging');
  });
});
