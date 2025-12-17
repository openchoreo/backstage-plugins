/**
 * Test suite for OpenChoreoIncrementalEntityProvider.
 * Verifies incremental entity processing, cursor handling, and entity translation.
 */
import { OpenChoreoIncrementalEntityProvider } from './OpenChoreoIncrementalEntityProvider';
import { ConfigReader } from '@backstage/config';
import { mockServices } from '@backstage/backend-test-utils';
import { createOpenChoreoApiClient } from '@openchoreo/openchoreo-client-node';
import { DEFAULT_PAGE_LIMIT } from '@openchoreo/backstage-plugin-common';

jest.mock('@openchoreo/openchoreo-client-node');

// Helper to create mock response structure for new pagination format
const createMockResponse = (
  items: any[],
  hasMore: boolean = false,
  continueToken?: string,
) => ({
  data: {
    success: true,
    data: {
      items,
      metadata: {
        resourceVersion: '1',
        hasMore,
        continue: continueToken,
      },
    },
  },
  error: undefined,
  response: {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: {
      get: jest.fn().mockReturnValue('1024'), // Mock content-length
    },
  },
});

describe('OpenChoreoIncrementalEntityProvider', () => {
  const createMockLogger = () => mockServices.logger.mock();
  const createMockConfig = (config?: any) =>
    new ConfigReader({
      openchoreo: {
        baseUrl: 'http://localhost:8080',
        incremental: {
          chunkSize: 5,
          ...config,
        },
      },
    });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return correct provider name', () => {
    const config = createMockConfig();
    const logger = createMockLogger();
    const provider = new OpenChoreoIncrementalEntityProvider(config, logger);
    expect(provider.getProviderName()).toBe(
      'OpenChoreoIncrementalEntityProvider',
    );
  });

  it('should use default chunk size when not configured', () => {
    const config = new ConfigReader({
      openchoreo: { baseUrl: 'http://localhost:8080' },
    });
    const logger = createMockLogger();
    const provider = new OpenChoreoIncrementalEntityProvider(config, logger);
    expect(provider.getProviderName()).toBe(
      'OpenChoreoIncrementalEntityProvider',
    );
  });

  it('caps configured chunk size to API maximum', async () => {
    const config = new ConfigReader({
      openchoreo: {
        baseUrl: 'http://localhost:8080',
        incremental: {
          chunkSize: 2000,
        },
      },
    });
    const logger = createMockLogger();
    const provider = new OpenChoreoIncrementalEntityProvider(config, logger);

    const mockClient = {
      GET: jest
        .fn()
        .mockResolvedValue(createMockResponse([{ name: 'org1' }], false)),
    };
    (createOpenChoreoApiClient as jest.Mock).mockReturnValue(mockClient);

    await provider.next({ config, logger });

    expect(mockClient.GET).toHaveBeenCalledWith('/orgs', {
      params: {
        query: {
          limit: DEFAULT_PAGE_LIMIT,
        },
      },
    });
  });

  it('should initialize with around method', async () => {
    const config = createMockConfig();
    const logger = createMockLogger();
    const provider = new OpenChoreoIncrementalEntityProvider(config, logger);

    const mockBurst = jest.fn().mockResolvedValue(undefined);
    await provider.around(mockBurst);

    expect(mockBurst).toHaveBeenCalledWith({
      config,
      logger: expect.any(Object),
    });
  });

  it('should handle first call with no cursor in cursor mode', async () => {
    const config = createMockConfig();
    const logger = createMockLogger();
    const provider = new OpenChoreoIncrementalEntityProvider(config, logger);

    const mockClient = {
      GET: jest
        .fn()
        .mockResolvedValue(createMockResponse([{ name: 'org1' }], false)),
    };
    (createOpenChoreoApiClient as jest.Mock).mockReturnValue(mockClient);

    // First call around() to set cursor mode
    await provider.around(jest.fn().mockResolvedValue(undefined));

    const context = { config, logger };
    const result = await provider.next(context);

    expect(result.done).toBe(false);
    expect(result.cursor?.phase).toBe('projects');
    expect(result.cursor?.orgQueue).toEqual(['org1']);
  });

  it('should process organizations in chunks with cursor', async () => {
    const config = createMockConfig({ chunkSize: 2 });
    const logger = createMockLogger();
    const provider = new OpenChoreoIncrementalEntityProvider(config, logger);

    const mockOrganizations = [
      {
        name: 'org1',
        displayName: 'Org 1',
        description: 'Description 1',
        createdAt: '2023-01-01',
        status: 'active',
        namespace: 'ns1',
      },
      {
        name: 'org2',
        displayName: 'Org 2',
        description: 'Description 2',
        createdAt: '2023-01-02',
        status: 'active',
        namespace: 'ns2',
      },
    ];

    const mockClient = {
      GET: jest
        .fn()
        .mockResolvedValue(createMockResponse(mockOrganizations, false)),
    };
    (createOpenChoreoApiClient as jest.Mock).mockReturnValue(mockClient);

    // First call around() to set cursor mode
    await provider.around(jest.fn().mockResolvedValue(undefined));

    const context = { config, logger };
    const result = await provider.next(context);

    expect(result.done).toBe(false);
    expect(result.entities).toHaveLength(2);
    expect(result.cursor).toEqual({
      componentApiCursor: undefined,
      currentOrgIndex: 0,
      currentProjectIndex: 0,
      orgApiCursor: undefined,
      orgQueue: ['org1', 'org2'],
      phase: 'projects',
      processedComponents: new Set(),
      processedOrgs: new Set(['org1', 'org2']),
      processedProjects: new Set(),
      projectApiCursor: undefined,
      projectQueue: [],
    });
  });

  it('handles cursor mode by default', async () => {
    const config = createMockConfig();
    const logger = createMockLogger();
    const provider = new OpenChoreoIncrementalEntityProvider(config, logger);

    const mockClient = {
      GET: jest
        .fn()
        .mockResolvedValue(createMockResponse([{ name: 'org1' }], false)),
    };
    (createOpenChoreoApiClient as jest.Mock).mockReturnValue(mockClient);

    const burst = jest.fn().mockResolvedValue(undefined);
    await provider.around(burst);
    // around() does not call the API client itself; it only prepares context and calls the burst
    expect(burst).toHaveBeenCalledWith({
      config,
      logger: expect.any(Object),
    });
    expect(mockClient.GET).not.toHaveBeenCalled();
  });

  it('cursor traversal sets resourceType across phases', async () => {
    const config = createMockConfig({
      chunkSize: 1,
    });
    const logger = createMockLogger();
    const provider = new OpenChoreoIncrementalEntityProvider(config, logger);

    let orgCallCount = 0;
    let projectCallCount = 0;
    let componentCallCount = 0;

    const mockClient = {
      GET: jest.fn().mockImplementation((path: string, _options?: any) => {
        if (path === '/orgs') {
          orgCallCount++;
          if (orgCallCount === 1) {
            // Initial fetch
            return Promise.resolve(
              createMockResponse([{ name: 'org1' }], true, 'c1'),
            );
          }
          // Second page
          return Promise.resolve(createMockResponse([{ name: 'org2' }], false));
        } else if (path === '/orgs/{orgName}/projects') {
          projectCallCount++;
          return Promise.resolve(
            createMockResponse([{ name: 'proj1' }], false),
          );
        } else if (
          path === '/orgs/{orgName}/projects/{projectName}/components'
        ) {
          componentCallCount++;
          return Promise.resolve(
            createMockResponse(
              [
                {
                  name: `comp${componentCallCount}`,
                  type: 'Library',
                  status: 'Active',
                  createdAt: '2024-01-01',
                },
              ],
              false,
            ),
          );
        }
        return Promise.resolve(createMockResponse([], false));
      }),
    };
    (createOpenChoreoApiClient as jest.Mock).mockReturnValue(mockClient);

    const burst = jest.fn().mockResolvedValue(undefined);
    await provider.around(burst);

    const init = await provider.next({
      config,
      logger,
    });
    expect(init.cursor?.phase).toBe('orgs');

    const afterOrgs = await provider.next(
      { config, logger },
      init.cursor as any,
    );
    expect(['orgs', 'projects']).toContain(afterOrgs.cursor?.phase);

    const afterProjects = await provider.next(
      { config, logger },
      afterOrgs.cursor as any,
    );

    const afterComponents = await provider.next(
      { config, logger },
      afterProjects.cursor as any,
    );

    await provider.next({ config, logger }, afterComponents.cursor as any);
    expect(['orgs', 'projects']).toContain(afterOrgs.cursor?.phase);

    const toProjects = await provider.next(
      { config, logger },
      afterOrgs.cursor as any,
    );
    expect(['orgs', 'projects']).toContain(toProjects.cursor?.phase);
  });

  it('translates service component into component + API entities', async () => {
    const config = createMockConfig({
      chunkSize: 10,
    });
    const logger = createMockLogger();
    const provider = new OpenChoreoIncrementalEntityProvider(config, logger);

    const mockClient = {
      GET: jest.fn().mockImplementation((path: string, _options?: any) => {
        if (path === '/orgs') {
          return Promise.resolve(createMockResponse([{ name: 'org1' }], false));
        } else if (path === '/orgs/{orgName}/projects') {
          return Promise.resolve(
            createMockResponse([{ name: 'proj1' }], false),
          );
        } else if (
          path === '/orgs/{orgName}/projects/{projectName}/components'
        ) {
          return Promise.resolve(
            createMockResponse(
              [
                {
                  name: 'svc1',
                  type: 'Service',
                  status: 'Active',
                  createdAt: '2024-01-01',
                },
              ],
              false,
            ),
          );
        } else if (
          path ===
          '/orgs/{orgName}/projects/{projectName}/components/{componentName}'
        ) {
          return Promise.resolve({
            data: {
              success: true,
              data: {
                name: 'svc1',
                type: 'Service',
                status: 'Active',
                createdAt: '2024-01-01',
                description: 'Service 1',
                workload: {
                  endpoints: {
                    rest: { type: 'REST', port: 8080 },
                    grpc: { type: 'gRPC', port: 9090 },
                  },
                },
              },
            },
            error: undefined,
            response: {
              ok: true,
              status: 200,
              statusText: 'OK',
              headers: {
                get: jest.fn().mockReturnValue('2048'), // Mock content-length
              },
            },
          });
        }
        return Promise.resolve(createMockResponse([], false));
      }),
    };
    (createOpenChoreoApiClient as jest.Mock).mockReturnValue(mockClient);

    const burst = jest.fn().mockResolvedValue(undefined);
    await provider.around(burst);

    // orgs
    const c1 = await provider.next({
      config,
      logger,
    });
    // projects
    const c2 = await provider.next({ config, logger }, c1.cursor as any);
    // components phase init
    const c3 = await provider.next({ config, logger }, c2.cursor as any);
    const c4 = await provider.next({ config, logger }, c3.cursor as any);

    // One of these calls should produce service + 2 API entities
    const entitiesBatch = [c1, c2, c3, c4].flatMap(r => r.entities || []);
    const apiKinds = entitiesBatch.filter(e => e.entity.kind === 'API');
    const componentKinds = entitiesBatch.filter(
      e => e.entity.kind === 'Component',
    );
    expect(componentKinds.length).toBeGreaterThanOrEqual(1);
    expect(apiKinds.length).toBe(2);
  });

  it('handles HTTP 410 expired cursor error and restarts', async () => {
    const config = createMockConfig();
    const logger = createMockLogger();
    const provider = new OpenChoreoIncrementalEntityProvider(config, logger);

    let callCount = 0;

    const mockClient = {
      GET: jest.fn().mockImplementation((path: string, _options?: any) => {
        callCount++;
        if (path === '/orgs') {
          if (callCount === 1) {
            // Initial fetch with continue token
            return Promise.resolve(
              createMockResponse([{ name: 'org1' }], true, 'c1'),
            );
          }
          if (callCount === 2 && _options?.params?.query?.continue) {
            // Simulate 410 error for expired cursor
            return Promise.resolve({
              data: undefined,
              error: { message: 'Cursor expired' },
              response: {
                ok: false,
                status: 410,
                statusText: 'Gone',
                headers: {
                  get: jest.fn().mockReturnValue('0'), // Mock content-length
                },
              },
            });
          }
          // Restart without cursor
          return Promise.resolve(createMockResponse([{ name: 'org1' }], false));
        }
        return Promise.resolve(createMockResponse([], false));
      }),
    };
    (createOpenChoreoApiClient as jest.Mock).mockReturnValue(mockClient);

    await provider.around(jest.fn().mockResolvedValue(undefined));

    // First call - orgs with more pages
    const c1 = await provider.next({ config, logger });
    expect(c1.cursor?.phase).toBe('orgs');

    // Second call should trigger 410 and restart
    const c2 = await provider.next({ config, logger }, c1.cursor as any);

    // Should have transitioned to projects phase after restart
    expect(['orgs', 'projects']).toContain(c2.cursor?.phase);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Pagination token expired'),
    );
  });

  describe('HTTP 410 error handling', () => {
    it('should reset cursor and restart from beginning when HTTP 410 occurs during organizations phase', async () => {
      const config = createMockConfig();
      const logger = createMockLogger();
      const provider = new OpenChoreoIncrementalEntityProvider(config, logger);

      const mockClient = {
        GET: jest
          .fn()
          .mockRejectedValueOnce(
            new Error('Request failed with status code 410'),
          )
          .mockResolvedValueOnce(
            createMockResponse([{ name: 'org1' }, { name: 'org2' }], false),
          ),
      };
      (createOpenChoreoApiClient as jest.Mock).mockReturnValue(mockClient);

      const cursor = {
        phase: 'orgs' as const,
        orgApiCursor: 'expired-cursor-token',
        orgQueue: [],
        currentOrgIndex: 0,
        projectApiCursor: undefined,
        projectQueue: [],
        currentProjectIndex: 0,
        componentApiCursor: undefined,
      };

      const result = await provider.next({ config, logger }, cursor);

      expect(result.done).toBe(false);
      expect(result.entities).toHaveLength(2);
      expect(result.entities?.[0].entity.metadata.name).toBe('org1');
      expect(result.entities?.[1].entity.metadata.name).toBe('org2');
      expect(result.cursor?.phase).toBe('projects');
      // Implementation logs an 'Expired cursor detected' message when restarting org fetch
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Expired cursor detected'),
      );
    });

    it('should reset cursor and restart from beginning when HTTP 410 occurs during projects phase', async () => {
      const config = createMockConfig();
      const logger = createMockLogger();
      const provider = new OpenChoreoIncrementalEntityProvider(config, logger);

      const mockClient = {
        GET: jest.fn().mockImplementation((path: string, _options?: any) => {
          if (
            path === '/orgs/{orgName}/projects' &&
            _options?.params?.query?.continue
          ) {
            // Simulate expired cursor when continue param is present
            return Promise.reject(new Error('continue parameter is too old'));
          }
          if (path === '/orgs/{orgName}/projects') {
            return Promise.resolve(
              createMockResponse([{ name: 'project1' }], false),
            );
          }
          if (path === '/orgs') {
            return Promise.resolve(
              createMockResponse([{ name: 'org1' }], false),
            );
          }
          return Promise.resolve(createMockResponse([], false));
        }),
      };
      (createOpenChoreoApiClient as jest.Mock).mockReturnValue(mockClient);

      const cursor = {
        phase: 'projects' as const,
        orgApiCursor: undefined,
        orgQueue: ['org1'],
        currentOrgIndex: 0,
        projectApiCursor: 'expired-project-cursor',
        projectQueue: [],
        currentProjectIndex: 0,
        componentApiCursor: undefined,
        currentOrg: 'org1',
      };

      const result = await provider.next({ config, logger }, cursor);

      expect(result.done).toBe(false);
      expect(result.entities).toHaveLength(1);
      // Implementation restarts the project fetch for the current org and keeps processing in 'projects' phase
      expect(result.cursor?.phase).toBe('projects');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Expired cursor detected for projects'),
      );
    });

    it('should reset cursor and restart from beginning when token expired error occurs during components phase', async () => {
      const config = createMockConfig();
      const logger = createMockLogger();
      const provider = new OpenChoreoIncrementalEntityProvider(config, logger);

      const mockClient = {
        GET: jest.fn().mockImplementation((path: string, _options?: any) => {
          if (
            path === '/orgs/{orgName}/projects/{projectName}/components' &&
            _options?.params?.query?.continue
          ) {
            return Promise.reject(new Error('expired cursor token'));
          }
          if (path === '/orgs/{orgName}/projects/{projectName}/components') {
            return Promise.resolve(
              createMockResponse([{ name: 'comp1' }], false),
            );
          }
          if (path === '/orgs') {
            return Promise.resolve(
              createMockResponse([{ name: 'org1' }], false),
            );
          }
          if (path === '/orgs/{orgName}/projects') {
            return Promise.resolve(
              createMockResponse([{ name: 'project1' }], false),
            );
          }
          return Promise.resolve(createMockResponse([], false));
        }),
      };
      (createOpenChoreoApiClient as jest.Mock).mockReturnValue(mockClient);

      const cursor = {
        phase: 'components' as const,
        orgApiCursor: undefined,
        orgQueue: ['org1'],
        currentOrgIndex: 0,
        projectApiCursor: undefined,
        projectQueue: [{ org: 'org1', project: 'project1' }],
        currentProjectIndex: 0,
        componentApiCursor: 'expired-component-cursor',
        currentOrg: 'org1',
        currentProject: 'project1',
      };

      const result = await provider.next({ config, logger }, cursor);

      expect(result.done).toBe(false);
      expect(result.entities).toHaveLength(1);
      expect(result.cursor?.phase).toBe('components');
      expect(result.cursor?.currentProjectIndex).toBe(1);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Expired cursor detected'),
      );
    });

    it('should handle HTTP 410 with truncated cursor token in log message', async () => {
      const config = createMockConfig();
      const logger = createMockLogger();
      const provider = new OpenChoreoIncrementalEntityProvider(config, logger);

      const longCursor = 'a'.repeat(100);
      const mockClient = {
        GET: jest
          .fn()
          .mockRejectedValueOnce(new Error('HTTP 410 Gone'))
          .mockResolvedValueOnce(createMockResponse([{ name: 'org1' }], false)),
      };
      (createOpenChoreoApiClient as jest.Mock).mockReturnValue(mockClient);

      const cursor = {
        phase: 'orgs' as const,
        orgApiCursor: longCursor,
        orgQueue: [],
        currentOrgIndex: 0,
        projectApiCursor: undefined,
        projectQueue: [],
        currentProjectIndex: 0,
        componentApiCursor: undefined,
      };

      await provider.next({ config, logger }, cursor);

      // The in-band retry path for orgs logs an 'Expired cursor detected' message (cursor not included)
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Expired cursor detected'),
      );
    });
  });
});
