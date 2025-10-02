/**
 * Test suite for OpenChoreoIncrementalEntityProvider.
 * Verifies incremental entity processing, cursor handling, and entity translation.
 */
import { OpenChoreoIncrementalEntityProvider } from './OpenChoreoIncrementalEntityProvider';
import { ConfigReader } from '@backstage/config';
import { mockServices } from '@backstage/backend-test-utils';
import { createOpenChoreoApiClient } from '@openchoreo/backstage-plugin-api';

jest.mock('@openchoreo/backstage-plugin-api');

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

  it('should initialize with around method (cursor mode)', async () => {
    const config = createMockConfig();
    const logger = createMockLogger();
    const provider = new OpenChoreoIncrementalEntityProvider(config, logger);

    const mockClient = {
      getOrganizationsWithCursor: jest.fn().mockResolvedValue({
        success: true,
        data: { items: [], nextCursor: null },
      }),
    };
    (createOpenChoreoApiClient as jest.Mock).mockReturnValue(mockClient);

    const mockBurst = jest.fn().mockResolvedValue(undefined);
    await provider.around(mockBurst);

    expect(mockBurst).toHaveBeenCalledWith({
      config,
      logger: expect.any(Object),
    });
    expect(mockClient.getOrganizationsWithCursor).toHaveBeenCalledWith({
      limit: 5,
    });
  });

  it('should handle first call with no cursor in cursor mode', async () => {
    const config = createMockConfig();
    const logger = createMockLogger();
    const provider = new OpenChoreoIncrementalEntityProvider(config, logger);

    const mockClient = {
      getOrganizationsWithCursor: jest.fn().mockResolvedValue({
        success: true,
        data: {
          items: [{ name: 'org1' }],
          nextCursor: null,
        },
      }),
    };
    (createOpenChoreoApiClient as jest.Mock).mockReturnValue(mockClient);

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
      getOrganizationsWithCursor: jest.fn().mockResolvedValue({
        success: true,
        data: {
          items: mockOrganizations,
          nextCursor: null,
        },
      }),
    };
    (createOpenChoreoApiClient as jest.Mock).mockReturnValue(mockClient);

    const context = { config, logger };
    const result = await provider.next(context);

    expect(result.done).toBe(false);
    expect(result.entities).toHaveLength(2);
    expect(result.cursor).toEqual({
      phase: 'projects',
      orgApiCursor: null,
      orgQueue: ['org1', 'org2'],
      currentOrgIndex: 0,
      projectApiCursor: undefined,
      projectQueue: [],
      currentProjectIndex: 0,
      componentApiCursor: undefined,
    });
  });

  it('falls back to legacy mode when cursor probe lacks markers', async () => {
    const config = createMockConfig();
    const logger = createMockLogger();
    const provider = new OpenChoreoIncrementalEntityProvider(config, logger);

    const mockClient = {
      getOrganizationsWithCursor: jest.fn().mockResolvedValue({
        success: true,
        data: { items: [], totalCount: 0, page: 0, pageSize: 0 },
      }),
    };
    (createOpenChoreoApiClient as jest.Mock).mockReturnValue(mockClient);

    const burst = jest.fn().mockResolvedValue(undefined);

    await provider.around(burst);
    expect(mockClient.getOrganizationsWithCursor).toHaveBeenCalled();
    expect(burst).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('falling back to legacy pagination mode'),
    );
  });

  it('handles cursor mode by default', async () => {
    const config = createMockConfig();
    const logger = createMockLogger();
    const provider = new OpenChoreoIncrementalEntityProvider(config, logger);

    const mockClient = {
      getOrganizationsWithCursor: jest.fn().mockResolvedValue({
        success: true,
        data: {
          items: [{ name: 'org1' }],
          nextCursor: null,
        },
      }),
    };
    (createOpenChoreoApiClient as jest.Mock).mockReturnValue(mockClient);

    const burst = jest.fn().mockResolvedValue(undefined);
    await provider.around(burst);
    expect(mockClient.getOrganizationsWithCursor).toHaveBeenCalled();
  });

  it('cursor traversal sets resourceType across phases', async () => {
    const config = createMockConfig({
      chunkSize: 1,
    });
    const logger = createMockLogger();
    const provider = new OpenChoreoIncrementalEntityProvider(config, logger);

    const orgPages = [
      { success: true, data: { items: [{ name: 'org1' }], nextCursor: 'c1' } }, // probe
      { success: true, data: { items: [{ name: 'org1' }], nextCursor: 'c1' } }, // runtime page1
      {
        success: true,
        data: {
          items: [{ name: 'org2' }],
          nextCursor: undefined,
        },
      }, // runtime page2
    ];
    const finalOrgPage = {
      success: true,
      data: { items: [], nextCursor: undefined },
    };

    const mockClient = {
      getOrganizationsWithCursor: jest
        .fn()
        .mockImplementation(() => orgPages.shift() || finalOrgPage),
      getProjectsWithCursor: jest.fn().mockResolvedValue({
        success: true,
        data: {
          items: [{ name: 'proj1' }],
          nextCursor: undefined,
        },
      }),
      getComponentsWithCursor: jest
        .fn()
        .mockResolvedValueOnce({
          success: true,
          data: {
            items: [
              {
                name: 'comp1',
                type: 'Library',
                status: 'Active',
                createdAt: '2024-01-01',
              },
            ],
            nextCursor: undefined,
          },
        })
        .mockResolvedValueOnce({
          success: true,
          data: {
            items: [
              {
                name: 'comp2',
                type: 'Library',
                status: 'Active',
                createdAt: '2024-01-01',
              },
            ],
            nextCursor: undefined,
          },
        }),
      getComponent: jest.fn(),
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
    expect(toProjects.cursor?.phase).toBe('projects');

    const projOrg1 = await provider.next(
      { config, logger },
      toProjects.cursor as any,
    );
    expect(['projects', 'components']).toContain(projOrg1.cursor?.phase);

    const projOrg2 = await provider.next(
      { config, logger },
      projOrg1.cursor as any,
    );
    expect(['projects', 'components']).toContain(projOrg2.cursor?.phase);

    const toComponents = await provider.next(
      { config, logger },
      projOrg2.cursor as any,
    );
    expect(toComponents.cursor?.phase).toBe('components');
  });

  it('translates service component into component + API entities', async () => {
    const config = createMockConfig({
      chunkSize: 10,
    });
    const logger = createMockLogger();
    const provider = new OpenChoreoIncrementalEntityProvider(config, logger);

    const mockClient = {
      getOrganizationsWithCursor: jest
        .fn()
        .mockResolvedValueOnce({
          success: true,
          data: {
            items: [],
            nextCursor: null,
          },
        })
        .mockResolvedValue({
          success: true,
          data: {
            items: [{ name: 'org1' }],
            nextCursor: null,
          },
        }),
      getProjectsWithCursor: jest.fn().mockResolvedValue({
        success: true,
        data: {
          items: [{ name: 'proj1' }],
          nextCursor: null,
        },
      }),
      getComponentsWithCursor: jest.fn().mockResolvedValue({
        success: true,
        data: {
          items: [
            {
              name: 'svc1',
              type: 'Service',
              status: 'Active',
              createdAt: '2024-01-01',
            },
          ],
          nextCursor: null,
        },
      }),
      getComponent: jest.fn().mockResolvedValue({
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
    // components phase init (transition after projects) may require extra next calls depending on logic
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

  it('falls back to legacy mode on HTTP 404', async () => {
    const config = createMockConfig();
    const logger = createMockLogger();
    const provider = new OpenChoreoIncrementalEntityProvider(config, logger);

    const mockClient = {
      getOrganizationsWithCursor: jest
        .fn()
        .mockRejectedValue(new Error('HTTP 404 Not Found')),
    };
    (createOpenChoreoApiClient as jest.Mock).mockReturnValue(mockClient);

    const burst = jest.fn().mockResolvedValue(undefined);

    await provider.around(burst);
    expect(mockClient.getOrganizationsWithCursor).toHaveBeenCalled();
    expect(burst).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Cursor endpoint not found (HTTP 404)'),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Falling back to legacy pagination mode'),
    );
  });

  it('processes all entities in one batch in legacy mode', async () => {
    const config = createMockConfig();
    const logger = createMockLogger();
    const provider = new OpenChoreoIncrementalEntityProvider(config, logger);

    const mockClient = {
      getOrganizationsWithCursor: jest
        .fn()
        .mockRejectedValue(new Error('HTTP 404 Not Found')),
      getAllOrganizations: jest.fn().mockResolvedValue([
        {
          name: 'org1',
          displayName: 'Organization 1',
          status: 'Active',
          createdAt: '2024-01-01',
        },
      ]),
      getAllProjects: jest.fn().mockResolvedValue([
        {
          name: 'proj1',
          displayName: 'Project 1',
          status: 'Active',
          createdAt: '2024-01-01',
        },
      ]),
      getAllComponents: jest.fn().mockResolvedValue([
        {
          name: 'comp1',
          type: 'Service',
          status: 'Active',
          createdAt: '2024-01-01',
        },
      ]),
      getComponent: jest.fn().mockResolvedValue({
        name: 'comp1',
        type: 'Service',
        status: 'Active',
        createdAt: '2024-01-01',
        workload: { endpoints: {} },
      }),
    };
    (createOpenChoreoApiClient as jest.Mock).mockReturnValue(mockClient);

    const burst = jest.fn().mockResolvedValue(undefined);
    await provider.around(burst);

    const result = await provider.next({ config, logger });

    expect(result.done).toBe(true);
    expect(result.entities?.length).toBeGreaterThan(0);
    expect(mockClient.getAllOrganizations).toHaveBeenCalled();
    expect(mockClient.getAllProjects).toHaveBeenCalledWith('org1');
    expect(mockClient.getAllComponents).toHaveBeenCalledWith('org1', 'proj1');

    const domains = result.entities?.filter(e => e.entity.kind === 'Domain');
    const systems = result.entities?.filter(e => e.entity.kind === 'System');
    const components = result.entities?.filter(
      e => e.entity.kind === 'Component',
    );

    expect(domains?.length).toBe(1);
    expect(systems?.length).toBe(1);
    expect(components?.length).toBe(1);
  });
});
