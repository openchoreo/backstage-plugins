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
      rolloutRestartReleaseBinding: jest.fn(),
      createComponentRelease: jest.fn(),
      deployRelease: jest.fn(),
      fetchComponentReleaseSchema: jest.fn(),
      fetchComponentRelease: jest.fn(),
      fetchReleaseBindings: jest.fn(),
      applyReleaseBinding: jest.fn(),
      fetchResourceReleaseBindings: jest.fn(),
      fetchResourceEnvironmentInfo: jest.fn(),
      updateResourceReleaseBinding: jest.fn(),
      deleteResourceReleaseBinding: jest.fn(),
      fetchProjectEnvironmentInfo: jest.fn(),
      fetchProjectReleaseBindings: jest.fn(),
      updateProjectReleaseBinding: jest.fn(),
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
    resourceTypeInfoService: {
      fetchResourceTypeSchema: jest.fn(),
    },
    clusterResourceTypeInfoService: {
      fetchClusterResourceTypeSchema: jest.fn(),
    },
    resourceReleaseInfoService: {
      fetchResourceRelease: jest.fn(),
      fetchResourceReleaseSchema: jest.fn(),
    },
    projectReleaseInfoService: {
      fetchProjectRelease: jest.fn(),
      fetchProjectReleaseSchema: jest.fn(),
    },
    secretReferencesInfoService: {
      fetchSecretReferences: jest.fn(),
    },
    secretsService: {
      listSecrets: jest.fn(),
      getSecret: jest.fn(),
      createSecret: jest.fn(),
      updateSecret: jest.fn(),
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
    wirelogsInfoService: {
      openStream: jest.fn(),
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
    wirelogsStreamTimeoutMs: 900_000,
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

    it('rejects when a data value is not a string', async () => {
      const response = await request(app)
        .post('/secrets')
        .query({ namespaceName: 'ns' })
        .send({ ...validBody, data: { good: 'v', bad: 42 } });
      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain(
        'data.bad must be a string',
      );
    });

    it('rejects when a data value is null', async () => {
      const response = await request(app)
        .post('/secrets')
        .query({ namespaceName: 'ns' })
        .send({ ...validBody, data: { good: 'v', bad: null } });
      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain(
        'data.bad must be a string',
      );
    });

    it('rejects when labels is not an object', async () => {
      const response = await request(app)
        .post('/secrets')
        .query({ namespaceName: 'ns' })
        .send({ ...validBody, labels: ['a', 'b'] });
      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('labels must be an object');
    });

    it('rejects when a label value is not a string', async () => {
      const response = await request(app)
        .post('/secrets')
        .query({ namespaceName: 'ns' })
        .send({ ...validBody, labels: { team: 1 } });
      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain(
        'labels.team must be a string',
      );
    });

    it('forwards labels to the service when provided', async () => {
      const created = { name: 's1', namespace: 'ns', keys: ['k'] };
      services.secretsService.createSecret.mockResolvedValue(created);
      const labels = { 'openchoreo.dev/secret-type': 'git-credentials' };

      const response = await request(app)
        .post('/secrets')
        .query({ namespaceName: 'ns' })
        .send({ ...validBody, labels });

      expect(response.status).toBe(201);
      expect(services.secretsService.createSecret).toHaveBeenCalledWith(
        'ns',
        { ...validBody, labels },
        'mock-user-token',
      );
    });
  });

  describe('PUT /secrets/:secretName', () => {
    it('updates a secret on a valid request', async () => {
      const updated = { name: 's1', namespace: 'ns', keys: ['k'] };
      services.secretsService.updateSecret.mockResolvedValue(updated);

      const response = await request(app)
        .put('/secrets/s1')
        .query({ namespaceName: 'ns' })
        .send({ data: { k: 'v' } });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(updated);
      expect(services.secretsService.updateSecret).toHaveBeenCalledWith(
        'ns',
        's1',
        { data: { k: 'v' } },
        'mock-user-token',
      );
    });

    it('rejects when namespaceName is missing', async () => {
      const response = await request(app)
        .put('/secrets/s1')
        .send({ data: { k: 'v' } });
      expect(response.status).toBe(400);
      expect(services.secretsService.updateSecret).not.toHaveBeenCalled();
    });

    it('rejects when data is not an object', async () => {
      const response = await request(app)
        .put('/secrets/s1')
        .query({ namespaceName: 'ns' })
        .send({ data: ['k', 'v'] });
      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('data must be an object');
    });

    it('rejects when a label value is not a string', async () => {
      const response = await request(app)
        .put('/secrets/s1')
        .query({ namespaceName: 'ns' })
        .send({ data: { k: 'v' }, labels: { team: 1 } });
      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain(
        'labels.team must be a string',
      );
    });

    it('forwards labels to the service when provided', async () => {
      const updated = { name: 's1', namespace: 'ns', keys: ['k'] };
      services.secretsService.updateSecret.mockResolvedValue(updated);
      const labels = { 'openchoreo.dev/secret-type': 'git-credentials' };

      const response = await request(app)
        .put('/secrets/s1')
        .query({ namespaceName: 'ns' })
        .send({ data: { k: 'v' }, labels });

      expect(response.status).toBe(200);
      expect(services.secretsService.updateSecret).toHaveBeenCalledWith(
        'ns',
        's1',
        { data: { k: 'v' }, labels },
        'mock-user-token',
      );
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

  describe('POST /rollout-restart-binding', () => {
    it('restarts a binding and returns the result', async () => {
      const mockResult = { status: 'restarted' };
      services.environmentInfoService.rolloutRestartReleaseBinding.mockResolvedValue(
        mockResult,
      );

      const response = await request(app)
        .post('/rollout-restart-binding')
        .send({
          componentName: 'my-component',
          projectName: 'my-project',
          namespaceName: 'my-namespace',
          bindingName: 'my-binding',
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResult);
      expect(
        services.environmentInfoService.rolloutRestartReleaseBinding,
      ).toHaveBeenCalledWith(
        {
          componentName: 'my-component',
          projectName: 'my-project',
          namespaceName: 'my-namespace',
          bindingName: 'my-binding',
        },
        'mock-user-token',
      );
    });

    it('returns 400 when required body fields are missing', async () => {
      const response = await request(app)
        .post('/rollout-restart-binding')
        .send({ componentName: 'my-component' });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          message: expect.stringContaining(
            'componentName, projectName, namespaceName and bindingName are required',
          ),
        }),
      });
    });
  });

  describe('DELETE /delete-resource-release-binding', () => {
    it('forwards the request to deleteResourceReleaseBinding', async () => {
      services.environmentInfoService.deleteResourceReleaseBinding.mockResolvedValue(
        { success: true },
      );

      const response = await request(app)
        .delete('/delete-resource-release-binding')
        .send({
          resourceName: 'analytics-db',
          projectName: 'my-project',
          namespaceName: 'my-namespace',
          environment: 'dev',
        });

      expect(response.status).toBe(200);
      expect(
        services.environmentInfoService.deleteResourceReleaseBinding,
      ).toHaveBeenCalledWith(
        {
          resourceName: 'analytics-db',
          projectName: 'my-project',
          namespaceName: 'my-namespace',
          environment: 'dev',
        },
        'mock-user-token',
      );
    });

    it('returns 400 when required body fields are missing', async () => {
      const response = await request(app)
        .delete('/delete-resource-release-binding')
        .send({ resourceName: 'analytics-db' });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          message: expect.stringContaining(
            'resourceName, projectName, namespaceName and environment are required',
          ),
        }),
      });
    });
  });

  describe('PUT /update-resource-release-binding', () => {
    it('forwards the request to updateResourceReleaseBinding', async () => {
      services.environmentInfoService.updateResourceReleaseBinding.mockResolvedValue(
        { ok: true },
      );

      const response = await request(app)
        .put('/update-resource-release-binding')
        .send({
          resourceName: 'analytics-db',
          projectName: 'my-project',
          namespaceName: 'my-namespace',
          environment: 'dev',
          releaseName: 'analytics-db-new',
          retainPolicy: 'Retain',
        });

      expect(response.status).toBe(200);
      expect(
        services.environmentInfoService.updateResourceReleaseBinding,
      ).toHaveBeenCalledWith(
        {
          resourceName: 'analytics-db',
          projectName: 'my-project',
          namespaceName: 'my-namespace',
          environment: 'dev',
          releaseName: 'analytics-db-new',
          retainPolicy: 'Retain',
          resourceTypeEnvironmentConfigs: undefined,
        },
        'mock-user-token',
      );
    });

    it('returns 400 when required body fields are missing', async () => {
      const response = await request(app)
        .put('/update-resource-release-binding')
        .send({
          resourceName: 'analytics-db',
          projectName: 'my-project',
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          message: expect.stringContaining(
            'resourceName, projectName, namespaceName, environment and releaseName are required',
          ),
        }),
      });
    });
  });

  describe('GET /resource-environment-info', () => {
    it('returns env-info for a resource on success', async () => {
      const mockEnvInfo = [
        {
          name: 'dev',
          bindingName: 'analytics-db-dev',
          resourceRelease: 'analytics-db-abc',
          latestRelease: 'analytics-db-abc',
          outputs: [{ name: 'host', value: 'db.dev.svc' }],
          promotionTargets: [{ name: 'staging', resourceName: 'staging' }],
        },
        { name: 'staging', latestRelease: 'analytics-db-abc' },
      ];
      services.environmentInfoService.fetchResourceEnvironmentInfo.mockResolvedValue(
        mockEnvInfo,
      );

      const response = await request(app)
        .get('/resource-environment-info')
        .query({
          resourceName: 'analytics-db',
          projectName: 'my-project',
          namespaceName: 'my-namespace',
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockEnvInfo);
      expect(
        services.environmentInfoService.fetchResourceEnvironmentInfo,
      ).toHaveBeenCalledWith(
        {
          resourceName: 'analytics-db',
          projectName: 'my-project',
          namespaceName: 'my-namespace',
        },
        'mock-user-token',
      );
    });

    it('returns 400 when required query parameters are missing', async () => {
      const response = await request(app)
        .get('/resource-environment-info')
        .query({ resourceName: 'analytics-db' });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          message: expect.stringContaining(
            'resourceName, projectName and namespaceName are required',
          ),
        }),
      });
    });
  });

  describe('GET /resource-release-bindings', () => {
    it('returns transformed binding items wrapped in success envelope', async () => {
      services.environmentInfoService.fetchResourceReleaseBindings.mockResolvedValue(
        {
          items: [
            {
              metadata: {
                name: 'analytics-db-dev',
                namespace: 'my-namespace',
                creationTimestamp: '2025-01-06T11:00:00Z',
              },
              spec: {
                owner: {
                  projectName: 'my-project',
                  resourceName: 'analytics-db',
                },
                environment: 'dev',
                resourceRelease: 'analytics-db-abc',
              },
              status: {
                conditions: [
                  { type: 'Ready', status: 'True', reason: 'Ready' },
                ],
              },
            },
          ],
        },
      );

      const response = await request(app)
        .get('/resource-release-bindings')
        .query({
          resourceName: 'analytics-db',
          projectName: 'my-project',
          namespaceName: 'my-namespace',
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          items: [
            expect.objectContaining({
              name: 'analytics-db-dev',
              resourceName: 'analytics-db',
              projectName: 'my-project',
              environment: 'dev',
              releaseName: 'analytics-db-abc',
              status: 'Ready',
            }),
          ],
        },
      });
    });

    it('returns 400 when required query parameters are missing', async () => {
      const response = await request(app)
        .get('/resource-release-bindings')
        .query({ projectName: 'my-project' });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          message: expect.stringContaining(
            'resourceName, projectName and namespaceName are required',
          ),
        }),
      });
    });
  });

  describe('GET /project-environment-info', () => {
    it('returns env-info for a project on success', async () => {
      const mockEnvInfo = [
        {
          name: 'dev',
          bindingName: 'my-project-dev',
          projectRelease: 'my-project-abc',
          latestRelease: 'my-project-abc',
          namespace: 'dp-ns-my-project-dev-abc',
          promotionTargets: [{ name: 'staging', resourceName: 'staging' }],
        },
        { name: 'staging', latestRelease: 'my-project-abc' },
      ];
      services.environmentInfoService.fetchProjectEnvironmentInfo.mockResolvedValue(
        mockEnvInfo,
      );

      const response = await request(app)
        .get('/project-environment-info')
        .query({
          projectName: 'my-project',
          namespaceName: 'my-namespace',
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockEnvInfo);
      expect(
        services.environmentInfoService.fetchProjectEnvironmentInfo,
      ).toHaveBeenCalledWith(
        {
          projectName: 'my-project',
          namespaceName: 'my-namespace',
        },
        'mock-user-token',
      );
    });

    it('returns 400 when required query parameters are missing', async () => {
      const response = await request(app)
        .get('/project-environment-info')
        .query({ projectName: 'my-project' });

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

  describe('GET /project-release-bindings', () => {
    it('returns transformed binding items wrapped in success envelope', async () => {
      services.environmentInfoService.fetchProjectReleaseBindings.mockResolvedValue(
        {
          items: [
            {
              metadata: {
                name: 'my-project-dev',
                namespace: 'my-namespace',
                creationTimestamp: '2025-01-06T11:00:00Z',
              },
              spec: {
                owner: { projectName: 'my-project' },
                environment: 'dev',
                projectRelease: 'my-project-abc',
                environmentConfigs: { replicas: 2 },
              },
              status: {
                conditions: [
                  { type: 'Ready', status: 'True', reason: 'Ready' },
                ],
                namespace: 'dp-ns-my-project-dev-abc',
              },
            },
          ],
        },
      );

      const response = await request(app)
        .get('/project-release-bindings')
        .query({
          projectName: 'my-project',
          namespaceName: 'my-namespace',
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          items: [
            expect.objectContaining({
              name: 'my-project-dev',
              projectName: 'my-project',
              environment: 'dev',
              releaseName: 'my-project-abc',
              namespace: 'dp-ns-my-project-dev-abc',
              status: 'Ready',
            }),
          ],
        },
      });
    });

    it('returns 400 when required query parameters are missing', async () => {
      const response = await request(app)
        .get('/project-release-bindings')
        .query({ projectName: 'my-project' });

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

  describe('PUT /update-project-release-binding', () => {
    it('forwards the request to updateProjectReleaseBinding', async () => {
      services.environmentInfoService.updateProjectReleaseBinding.mockResolvedValue(
        { ok: true },
      );

      const response = await request(app)
        .put('/update-project-release-binding')
        .send({
          projectName: 'my-project',
          namespaceName: 'my-namespace',
          environment: 'dev',
          releaseName: 'my-project-new',
          environmentConfigs: { replicas: 3 },
        });

      expect(response.status).toBe(200);
      expect(
        services.environmentInfoService.updateProjectReleaseBinding,
      ).toHaveBeenCalledWith(
        {
          projectName: 'my-project',
          namespaceName: 'my-namespace',
          environment: 'dev',
          releaseName: 'my-project-new',
          environmentConfigs: { replicas: 3 },
        },
        'mock-user-token',
      );
    });

    it('returns 400 when required body fields are missing', async () => {
      const response = await request(app)
        .put('/update-project-release-binding')
        .send({ projectName: 'my-project' });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          message: expect.stringContaining(
            'projectName, namespaceName, environment and releaseName are required',
          ),
        }),
      });
    });
  });

  describe('GET /project-release-schema', () => {
    it('forwards the request to fetchProjectReleaseSchema', async () => {
      services.projectReleaseInfoService.fetchProjectReleaseSchema.mockResolvedValue(
        { success: true, data: { type: 'object' } },
      );

      const response = await request(app).get('/project-release-schema').query({
        namespaceName: 'my-namespace',
        releaseName: 'my-project-abc',
        section: 'environmentConfigs',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: { type: 'object' },
      });
      expect(
        services.projectReleaseInfoService.fetchProjectReleaseSchema,
      ).toHaveBeenCalledWith(
        'my-namespace',
        'my-project-abc',
        'environmentConfigs',
        'mock-user-token',
      );
    });

    it('returns 400 when section is not an allowed value', async () => {
      const response = await request(app).get('/project-release-schema').query({
        namespaceName: 'my-namespace',
        releaseName: 'my-project-abc',
        section: 'bogus',
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          message: expect.stringContaining('section must be one of'),
        }),
      });
    });
  });

  describe('GET /wirelogs/stream', () => {
    /**
     * Build a Response-like object whose body.getReader() yields the supplied
     * chunks. Mirrors what `fetch` returns for an upstream SSE stream.
     */
    function makeUpstream(chunks: Array<string>, ok = true, status = 200) {
      const encoder = new TextEncoder();
      let i = 0;
      const reader = {
        read: jest.fn(async () => {
          if (i >= chunks.length) {
            return { value: undefined, done: true } as const;
          }
          return {
            value: encoder.encode(chunks[i++]),
            done: false,
          } as const;
        }),
        cancel: jest.fn().mockResolvedValue(undefined),
      };
      return {
        ok,
        status,
        body: { getReader: () => reader },
        text: jest.fn().mockResolvedValue(''),
      } as unknown as Response;
    }

    it('returns 400 when required query params are missing', async () => {
      const response = await request(app).get('/wirelogs/stream').query({
        projectName: 'p',
      });
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          message: expect.stringContaining(
            'namespaceName, environmentName and projectName are required',
          ),
        }),
      });
      expect(services.wirelogsInfoService.openStream).not.toHaveBeenCalled();
    });

    it('streams upstream chunks through as text/event-stream', async () => {
      services.wirelogsInfoService.openStream.mockResolvedValue(
        makeUpstream([
          'data: {"flow":{"uuid":"a"}}\n\n',
          'data: {"flow":{"uuid":"b"}}\n\n',
        ]),
      );

      const response = await request(app).get('/wirelogs/stream').query({
        namespaceName: 'ns',
        environmentName: 'dev',
        projectName: 'proj',
        componentName: 'svc',
      });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/text\/event-stream/);
      expect(response.headers['cache-control']).toMatch(/no-cache/);
      // The stream opens with a `meta` frame advertising the hard cap.
      expect(response.text).toContain('event: meta');
      expect(response.text).toContain('hardTimeoutMs');
      expect(response.text).toContain('"uuid":"a"');
      expect(response.text).toContain('"uuid":"b"');

      // Service was called with the parsed query string + the mock token.
      expect(services.wirelogsInfoService.openStream).toHaveBeenCalledWith(
        {
          namespaceName: 'ns',
          environmentName: 'dev',
          projectName: 'proj',
          componentName: 'svc',
        },
        'mock-user-token',
        expect.any(AbortSignal),
      );
    });

    it('writes an SSE error frame when openStream rejects', async () => {
      services.wirelogsInfoService.openStream.mockRejectedValue(
        new Error('connect refused'),
      );

      const response = await request(app).get('/wirelogs/stream').query({
        namespaceName: 'ns',
        environmentName: 'dev',
        projectName: 'proj',
      });

      // The SSE headers were already flushed, so the status is 200 even on
      // an upstream failure — the error rides in the body as an SSE event.
      expect(response.status).toBe(200);
      expect(response.text).toContain('event: error');
      expect(response.text).toContain('Failed to open wirelogs stream');
      expect(services.logger.error).toHaveBeenCalled();
    });

    it('emits an SSE error frame when the upstream returns non-ok', async () => {
      services.wirelogsInfoService.openStream.mockResolvedValue({
        ok: false,
        status: 502,
        body: null,
        text: jest.fn().mockResolvedValue('bad gateway'),
      } as unknown as Response);

      const response = await request(app).get('/wirelogs/stream').query({
        namespaceName: 'ns',
        environmentName: 'dev',
        projectName: 'proj',
      });

      expect(response.status).toBe(200);
      expect(response.text).toContain('event: error');
      expect(response.text).toContain('"status":502');
      expect(response.text).toContain('bad gateway');
    });

    it('ends the stream with a timeout SSE frame when the hard cap is hit', async () => {
      // Fresh router with a tiny cap; the upstream never produces data and
      // only settles when the composed signal aborts (as a real fetch body
      // would), so the hard timeout is the only thing that can end it.
      const localServices = createMockServices();
      localServices.wirelogsStreamTimeoutMs = 50;
      localServices.wirelogsInfoService.openStream.mockImplementation(
        async (_req: any, _token: any, signal: AbortSignal) => {
          const reader = {
            read: jest.fn(
              () =>
                new Promise((_resolve, reject) => {
                  signal.addEventListener(
                    'abort',
                    () => reject(new DOMException('aborted', 'AbortError')),
                    { once: true },
                  );
                }),
            ),
            cancel: jest.fn().mockResolvedValue(undefined),
          };
          return {
            ok: true,
            status: 200,
            body: { getReader: () => reader },
            text: jest.fn().mockResolvedValue(''),
          } as unknown as Response;
        },
      );
      const localApp = express();
      localApp.use(await createRouter(localServices as any));
      localApp.use(mockErrorHandler());

      const response = await request(localApp).get('/wirelogs/stream').query({
        namespaceName: 'ns',
        environmentName: 'dev',
        projectName: 'proj',
      });

      expect(response.status).toBe(200);
      expect(response.text).toContain('event: timeout');
      expect(response.text).toContain('hardTimeoutMs');
    });

    it('emits a timeout frame (not an error) when the cap is hit before the upstream opens', async () => {
      const localServices = createMockServices();
      localServices.wirelogsStreamTimeoutMs = 50;
      // openStream never resolves; it rejects only once the hard-timeout abort
      // fires — exercising the pre-open abort branch in the catch.
      localServices.wirelogsInfoService.openStream.mockImplementation(
        (_req: any, _token: any, signal: AbortSignal) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener(
              'abort',
              () => reject(new DOMException('aborted', 'AbortError')),
              { once: true },
            );
          }),
      );
      const localApp = express();
      localApp.use(await createRouter(localServices as any));
      localApp.use(mockErrorHandler());

      const response = await request(localApp).get('/wirelogs/stream').query({
        namespaceName: 'ns',
        environmentName: 'dev',
        projectName: 'proj',
      });

      expect(response.status).toBe(200);
      expect(response.text).toContain('event: timeout');
      expect(response.text).not.toContain('Failed to open wirelogs stream');
    });
  });
});
