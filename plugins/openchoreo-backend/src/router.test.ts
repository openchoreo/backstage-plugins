import { mockErrorHandler } from '@backstage/backend-test-utils';
import express from 'express';
import request from 'supertest';
import { createRouter } from './router';
import type { OpenChoreoTokenService } from '@openchoreo/openchoreo-auth';

jest.mock('@openchoreo/openchoreo-auth', () => ({
  createUserTokenMiddleware: jest.fn(
    () => (_req: any, _res: any, next: any) => next(),
  ),
  getUserTokenFromRequest: jest.fn().mockReturnValue('mock-user-token'),
  createRequireAuthMiddleware: jest.fn(
    () => (_req: any, _res: any, next: any) => next(),
  ),
}));

function createMockServices() {
  return {
    environmentInfoService: {
      fetchDeploymentInfo: jest.fn(),
      promoteComponent: jest.fn(),
      deleteReleaseBinding: jest.fn(),
      updateComponentBinding: jest.fn(),
      createComponentRelease: jest.fn(),
      deployRelease: jest.fn(),
      fetchComponentReleaseSchema: jest.fn(),
      fetchComponentRelease: jest.fn(),
      fetchReleaseBindings: jest.fn(),
      applyReleaseBinding: jest.fn(),
    },
    cellDiagramInfoService: {
      fetchProjectInfo: jest.fn(),
    },
    buildInfoService: {
      fetchBuilds: jest.fn(),
      triggerBuild: jest.fn(),
    },
    componentInfoService: {
      fetchComponentDetails: jest.fn(),
      patchComponent: jest.fn(),
      fetchComponentTypeSchema: jest.fn(),
      updateComponentConfig: jest.fn(),
      createComponent: jest.fn(),
      deleteComponent: jest.fn(),
    },
    projectInfoService: {
      fetchProjectDetails: jest.fn(),
      fetchProjectDeploymentPipeline: jest.fn(),
      createProject: jest.fn(),
    },
    workloadInfoService: {
      fetchWorkloadInfo: jest.fn(),
      applyWorkload: jest.fn(),
    },
    dashboardInfoService: {
      fetchComponentsBindingsCount: jest.fn(),
    },
    traitInfoService: {
      fetchTraits: jest.fn(),
      fetchTraitSchema: jest.fn(),
      fetchComponentTraits: jest.fn(),
      updateComponentTraits: jest.fn(),
    },
    clusterTraitInfoService: {
      fetchClusterTraits: jest.fn(),
      fetchClusterTraitSchema: jest.fn(),
    },
    clusterComponentTypeInfoService: {
      fetchClusterComponentTypes: jest.fn(),
      fetchClusterComponentTypeSchema: jest.fn(),
    },
    secretReferencesInfoService: {
      fetchSecretReferences: jest.fn(),
    },
    gitSecretsService: {
      fetchGitSecrets: jest.fn(),
      createGitSecret: jest.fn(),
      deleteGitSecret: jest.fn(),
    },
    secretsService: {
      listSecrets: jest.fn(),
      getSecret: jest.fn(),
      createSecret: jest.fn(),
      deleteSecret: jest.fn(),
    },
    authzService: {
      checkAccess: jest.fn(),
    },
    dataPlaneInfoService: {
      fetchDataPlanes: jest.fn(),
    },
    clusterDataPlaneInfoService: {
      fetchClusterDataPlanes: jest.fn(),
    },
    platformResourceService: {
      fetchResources: jest.fn(),
      fetchResource: jest.fn(),
      createResource: jest.fn(),
      updateResource: jest.fn(),
      deleteResource: jest.fn(),
    },
    annotationStore: {
      getAnnotations: jest.fn(),
      setAnnotations: jest.fn(),
    },
    catalogService: {
      getEntities: jest.fn(),
    },
    auth: {
      getPluginRequestToken: jest.fn(),
      isPrincipal: jest.fn(),
      authenticate: jest.fn(),
      getLimitedUserToken: jest.fn(),
      getNoneCredentials: jest.fn(),
      getOwnServiceCredentials: jest.fn(),
      listPublicServiceKeys: jest.fn(),
    },
    tokenService: {
      getUserToken: jest.fn().mockReturnValue(undefined),
      getUserTokenRequired: jest.fn(),
      getServiceToken: jest.fn().mockResolvedValue('service-token'),
      hasServiceCredentials: jest.fn().mockReturnValue(false),
    } as jest.Mocked<OpenChoreoTokenService>,
    authEnabled: true,
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      child: jest.fn().mockReturnThis(),
    },
  };
}

describe('createRouter', () => {
  let app: express.Express;
  let services: ReturnType<typeof createMockServices>;

  beforeEach(async () => {
    services = createMockServices();
    const router = await createRouter(services as any);
    app = express();
    app.use(router);
    app.use(mockErrorHandler());
  });

  describe('GET /deploy', () => {
    it('should return deployment info on success', async () => {
      const mockDeployment = {
        environments: [
          { name: 'dev', status: 'active' },
          { name: 'prod', status: 'pending' },
        ],
      };
      services.environmentInfoService.fetchDeploymentInfo.mockResolvedValue(
        mockDeployment,
      );

      const response = await request(app).get('/deploy').query({
        componentName: 'my-component',
        projectName: 'my-project',
        namespaceName: 'my-namespace',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockDeployment);
      expect(
        services.environmentInfoService.fetchDeploymentInfo,
      ).toHaveBeenCalledWith(
        {
          componentName: 'my-component',
          projectName: 'my-project',
          namespaceName: 'my-namespace',
        },
        'mock-user-token',
      );
    });

    it('should return 400 when required query parameters are missing', async () => {
      const response = await request(app).get('/deploy').query({
        componentName: 'my-component',
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          message: expect.stringContaining(
            'componentName, projectName and namespaceName are required',
          ),
        }),
      });
    });
  });

  describe('POST /promote-deployment', () => {
    it('should promote a deployment on success', async () => {
      const mockResult = { success: true };
      services.environmentInfoService.promoteComponent.mockResolvedValue(
        mockResult,
      );

      const response = await request(app).post('/promote-deployment').send({
        sourceEnv: 'dev',
        targetEnv: 'prod',
        componentName: 'my-component',
        projectName: 'my-project',
        namespaceName: 'my-namespace',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResult);
      expect(
        services.environmentInfoService.promoteComponent,
      ).toHaveBeenCalledWith(
        {
          sourceEnvironment: 'dev',
          targetEnvironment: 'prod',
          componentName: 'my-component',
          projectName: 'my-project',
          namespaceName: 'my-namespace',
        },
        'mock-user-token',
      );
    });

    it('should return 400 when required body fields are missing', async () => {
      const response = await request(app).post('/promote-deployment').send({
        sourceEnv: 'dev',
        targetEnv: 'prod',
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          message: expect.stringContaining(
            'sourceEnv, targetEnv, componentName, projectName and namespaceName are required',
          ),
        }),
      });
    });
  });

  describe('GET /builds', () => {
    it('should return builds on success', async () => {
      const mockBuilds = {
        builds: [
          { id: 'build-1', status: 'success' },
          { id: 'build-2', status: 'running' },
        ],
      };
      services.buildInfoService.fetchBuilds.mockResolvedValue(mockBuilds);

      const response = await request(app).get('/builds').query({
        componentName: 'my-component',
        projectName: 'my-project',
        namespaceName: 'my-namespace',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockBuilds);
      expect(services.buildInfoService.fetchBuilds).toHaveBeenCalledWith(
        'my-namespace',
        'my-project',
        'my-component',
        'mock-user-token',
      );
    });

    it('should return 400 when required query parameters are missing', async () => {
      const response = await request(app).get('/builds').query({
        componentName: 'my-component',
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          message: expect.stringContaining(
            'componentName, projectName and namespaceName are required',
          ),
        }),
      });
    });
  });

  describe('POST /builds', () => {
    it('should trigger a build on success', async () => {
      const mockResult = { buildId: 'build-3', status: 'queued' };
      services.buildInfoService.triggerBuild.mockResolvedValue(mockResult);

      const response = await request(app).post('/builds').send({
        componentName: 'my-component',
        projectName: 'my-project',
        namespaceName: 'my-namespace',
        commit: 'abc123',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResult);
      expect(services.buildInfoService.triggerBuild).toHaveBeenCalledWith(
        'my-namespace',
        'my-project',
        'my-component',
        'abc123',
        'mock-user-token',
      );
    });

    it('should return 400 when required body fields are missing', async () => {
      const response = await request(app).post('/builds').send({
        componentName: 'my-component',
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          message: expect.stringContaining(
            'componentName, projectName and namespaceName are required',
          ),
        }),
      });
    });
  });

  describe('GET /component', () => {
    it('should return component details on success', async () => {
      const mockComponent = {
        name: 'my-component',
        type: 'service',
        autoDeploy: true,
      };
      services.componentInfoService.fetchComponentDetails.mockResolvedValue(
        mockComponent,
      );

      const response = await request(app).get('/component').query({
        componentName: 'my-component',
        projectName: 'my-project',
        namespaceName: 'my-namespace',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockComponent);
      expect(
        services.componentInfoService.fetchComponentDetails,
      ).toHaveBeenCalledWith(
        'my-namespace',
        'my-project',
        'my-component',
        'mock-user-token',
      );
    });

    it('should return 400 when required query parameters are missing', async () => {
      const response = await request(app).get('/component').query({
        componentName: 'my-component',
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          message: expect.stringContaining(
            'componentName, projectName and namespaceName are required',
          ),
        }),
      });
    });
  });

  describe('PATCH /component', () => {
    it('should patch component on success', async () => {
      const mockResult = { success: true, autoDeploy: false };
      services.componentInfoService.patchComponent.mockResolvedValue(
        mockResult,
      );

      const response = await request(app).patch('/component').send({
        componentName: 'my-component',
        projectName: 'my-project',
        namespaceName: 'my-namespace',
        autoDeploy: false,
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResult);
      expect(services.componentInfoService.patchComponent).toHaveBeenCalledWith(
        'my-namespace',
        'my-project',
        'my-component',
        false,
        'mock-user-token',
      );
    });

    it('should return 400 when required body fields are missing', async () => {
      const response = await request(app).patch('/component').send({
        componentName: 'my-component',
        autoDeploy: true,
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          message: expect.stringContaining(
            'componentName, projectName and namespaceName are required',
          ),
        }),
      });
    });

    it('should return 400 when autoDeploy is not a boolean', async () => {
      const response = await request(app).patch('/component').send({
        componentName: 'my-component',
        projectName: 'my-project',
        namespaceName: 'my-namespace',
        autoDeploy: 'yes',
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          message: expect.stringContaining(
            'autoDeploy must be a boolean value',
          ),
        }),
      });
    });
  });

  describe('GET /project', () => {
    it('should return project details on success', async () => {
      const mockProject = {
        name: 'my-project',
        namespace: 'my-namespace',
        components: [],
      };
      services.projectInfoService.fetchProjectDetails.mockResolvedValue(
        mockProject,
      );

      const response = await request(app).get('/project').query({
        projectName: 'my-project',
        namespaceName: 'my-namespace',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockProject);
      expect(
        services.projectInfoService.fetchProjectDetails,
      ).toHaveBeenCalledWith('my-namespace', 'my-project', 'mock-user-token');
    });

    it('should return 400 when required query parameters are missing', async () => {
      const response = await request(app).get('/project').query({
        projectName: 'my-project',
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          message: expect.stringContaining(
            'projectName and namespaceName are required',
          ),
        }),
      });
    });
  });

  describe('GET /secrets', () => {
    it('returns secrets for the namespace', async () => {
      const list = {
        items: [{ name: 's1' }],
        totalCount: 1,
        page: 1,
        pageSize: 100,
      };
      services.secretsService.listSecrets.mockResolvedValue(list);

      const response = await request(app)
        .get('/secrets')
        .query({ namespaceName: 'ns' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(list);
      expect(services.secretsService.listSecrets).toHaveBeenCalledWith(
        'ns',
        'mock-user-token',
      );
    });

    it('returns 400 when namespaceName is missing', async () => {
      const response = await request(app).get('/secrets');
      expect(response.status).toBe(400);
      expect(services.secretsService.listSecrets).not.toHaveBeenCalled();
    });
  });

  describe('GET /secrets/:secretName', () => {
    it('returns a single secret', async () => {
      const secret = { name: 's1', namespace: 'ns', keys: ['k1'] };
      services.secretsService.getSecret.mockResolvedValue(secret);

      const response = await request(app)
        .get('/secrets/s1')
        .query({ namespaceName: 'ns' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(secret);
      expect(services.secretsService.getSecret).toHaveBeenCalledWith(
        'ns',
        's1',
        'mock-user-token',
      );
    });

    it('returns 400 when namespaceName is missing', async () => {
      const response = await request(app).get('/secrets/s1');
      expect(response.status).toBe(400);
    });
  });

  describe('POST /secrets', () => {
    const validBody = {
      secretName: 's1',
      secretType: 'Opaque',
      targetPlane: { kind: 'DataPlane', name: 'dp' },
      data: { k: 'v' },
    };

    it('creates a secret on valid request', async () => {
      const created = { name: 's1', namespace: 'ns', keys: ['k'] };
      services.secretsService.createSecret.mockResolvedValue(created);

      const response = await request(app)
        .post('/secrets')
        .query({ namespaceName: 'ns' })
        .send(validBody);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(created);
      expect(services.secretsService.createSecret).toHaveBeenCalledWith(
        'ns',
        validBody,
        'mock-user-token',
      );
    });

    it('rejects when namespaceName is missing', async () => {
      const response = await request(app).post('/secrets').send(validBody);
      expect(response.status).toBe(400);
    });

    it('rejects when required body fields are missing', async () => {
      const response = await request(app)
        .post('/secrets')
        .query({ namespaceName: 'ns' })
        .send({ secretName: 's1' });
      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('are required');
    });

    it('rejects unsupported secretType', async () => {
      const response = await request(app)
        .post('/secrets')
        .query({ namespaceName: 'ns' })
        .send({ ...validBody, secretType: 'NotARealType' });
      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain(
        'secretType must be one of',
      );
    });

    it('rejects when targetPlane.kind/name are missing', async () => {
      const response = await request(app)
        .post('/secrets')
        .query({ namespaceName: 'ns' })
        .send({ ...validBody, targetPlane: { kind: 'DataPlane' } });
      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain(
        'targetPlane.kind and targetPlane.name are required',
      );
    });

    it('rejects unsupported targetPlane.kind', async () => {
      const response = await request(app)
        .post('/secrets')
        .query({ namespaceName: 'ns' })
        .send({
          ...validBody,
          targetPlane: { kind: 'NotAPlane', name: 'dp' },
        });
      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain(
        'targetPlane.kind must be one of',
      );
    });

    it('rejects when data is not an object', async () => {
      const response = await request(app)
        .post('/secrets')
        .query({ namespaceName: 'ns' })
        .send({ ...validBody, data: ['k', 'v'] });
      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('data must be an object');
    });
  });

  describe('DELETE /secrets/:secretName', () => {
    it('deletes a secret and returns 204', async () => {
      services.secretsService.deleteSecret.mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/secrets/s1')
        .query({ namespaceName: 'ns' });

      expect(response.status).toBe(204);
      expect(services.secretsService.deleteSecret).toHaveBeenCalledWith(
        'ns',
        's1',
        'mock-user-token',
      );
    });

    it('returns 400 when namespaceName is missing', async () => {
      const response = await request(app).delete('/secrets/s1');
      expect(response.status).toBe(400);
      expect(services.secretsService.deleteSecret).not.toHaveBeenCalled();
    });
  });
});
