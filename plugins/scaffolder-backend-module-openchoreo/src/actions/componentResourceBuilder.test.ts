import {
  buildComponentResource,
  buildWorkloadResource,
  ComponentResourceInput,
} from './componentResourceBuilder';

describe('buildComponentResource', () => {
  const minimalInput: ComponentResourceInput = {
    componentName: 'my-service',
    componentType: 'service',
    componentTypeWorkloadType: 'deployment',
  };

  it('should build basic component request with correct structure', () => {
    const result = buildComponentResource(minimalInput);

    expect(result.name).toBe('my-service');
    expect(result.componentType).toBe('deployment/service');
    expect(result.parameters).toEqual({});
    expect(result.autoDeploy).toBe(false);
  });

  it('should format componentType as workloadType/componentType', () => {
    const result = buildComponentResource(minimalInput);
    expect(result.componentType).toBe('deployment/service');
  });

  it('should set display name and description when provided', () => {
    const result = buildComponentResource({
      ...minimalInput,
      displayName: 'My Service',
      description: 'A test service',
    });

    expect(result.displayName).toBe('My Service');
    expect(result.description).toBe('A test service');
  });

  it('should not set display name or description when not provided', () => {
    const result = buildComponentResource(minimalInput);

    expect(result.displayName).toBeUndefined();
    expect(result.description).toBeUndefined();
  });

  it('should include CTD parameters in parameters', () => {
    const result = buildComponentResource({
      ...minimalInput,
      ctdParameters: { port: 8080, replicas: 3 },
    });

    expect(result.parameters).toEqual({ port: 8080, replicas: 3 });
  });

  it('should set autoDeploy when provided', () => {
    const result = buildComponentResource({
      ...minimalInput,
      autoDeploy: true,
    });

    expect(result.autoDeploy).toBe(true);
  });

  it('should default autoDeploy to false when not provided', () => {
    const result = buildComponentResource(minimalInput);
    expect(result.autoDeploy).toBe(false);
  });

  describe('workflow (build-from-source)', () => {
    it('should build workflow with name and converted parameters', () => {
      const result = buildComponentResource({
        ...minimalInput,
        deploymentSource: 'build-from-source',
        workflowName: 'google-cloud-buildpacks',
        workflowParameters: {
          'docker.context': '/app',
          'docker.filePath': '/Dockerfile',
        },
      });

      expect(result.workflow).toBeDefined();
      expect(result.workflow!.name).toBe('google-cloud-buildpacks');
      expect(result.workflow!.parameters).toEqual({
        docker: {
          context: '/app',
          filePath: '/Dockerfile',
        },
      });
    });

    it('should build systemParameters.repository from standalone fields', () => {
      const result = buildComponentResource({
        ...minimalInput,
        deploymentSource: 'build-from-source',
        workflowName: 'google-cloud-buildpacks',
        workflowParameters: {},
        repoUrl: 'https://github.com/org/repo.git',
        branch: 'develop',
        componentPath: 'services/api',
      });

      expect(result.workflow!.systemParameters).toEqual({
        repository: {
          url: 'https://github.com/org/repo.git',
          revision: { branch: 'develop' },
          appPath: 'services/api',
        },
      });
    });

    it('should include secretRef in systemParameters.repository when gitSecretRef is provided', () => {
      const result = buildComponentResource({
        ...minimalInput,
        deploymentSource: 'build-from-source',
        workflowName: 'google-cloud-buildpacks',
        workflowParameters: {},
        repoUrl: 'https://github.com/org/private-repo.git',
        branch: 'main',
        componentPath: '.',
        gitSecretRef: 'my-git-secret',
      });

      expect(result.workflow!.systemParameters).toEqual({
        repository: {
          url: 'https://github.com/org/private-repo.git',
          revision: { branch: 'main' },
          appPath: '.',
          secretRef: 'my-git-secret',
        },
      });
    });

    it('should not include secretRef when gitSecretRef is not provided', () => {
      const result = buildComponentResource({
        ...minimalInput,
        deploymentSource: 'build-from-source',
        workflowName: 'google-cloud-buildpacks',
        workflowParameters: {},
        repoUrl: 'https://github.com/org/repo.git',
        branch: 'main',
        componentPath: '.',
      });

      expect(
        (result.workflow!.systemParameters as any).repository.secretRef,
      ).toBeUndefined();
    });

    it('should default branch to main and componentPath to . when not provided', () => {
      const result = buildComponentResource({
        ...minimalInput,
        deploymentSource: 'build-from-source',
        workflowName: 'google-cloud-buildpacks',
        workflowParameters: {},
        repoUrl: 'https://github.com/org/repo.git',
      });

      expect(result.workflow!.systemParameters).toEqual({
        repository: {
          url: 'https://github.com/org/repo.git',
          revision: { branch: 'main' },
          appPath: '.',
        },
      });
    });

    it('should build workflow with empty systemParameters when repoUrl is not provided', () => {
      const result = buildComponentResource({
        ...minimalInput,
        deploymentSource: 'build-from-source',
        workflowName: 'google-cloud-buildpacks',
        workflowParameters: {},
      });

      expect(result.workflow).toBeDefined();
      expect(result.workflow!.name).toBe('google-cloud-buildpacks');
      // systemParameters is required by the type, so a default is provided
      expect(result.workflow!.systemParameters).toBeDefined();
    });
  });

  it('should not add workflow for deploy-from-image', () => {
    const result = buildComponentResource({
      ...minimalInput,
      deploymentSource: 'deploy-from-image',
      containerImage: 'nginx:latest',
    });

    expect(result.workflow).toBeUndefined();
  });

  it('should not add workflow for external-ci', () => {
    const result = buildComponentResource({
      ...minimalInput,
      deploymentSource: 'external-ci',
    });

    expect(result.workflow).toBeUndefined();
  });

  it('should build traits with nested parameters', () => {
    const result = buildComponentResource({
      ...minimalInput,
      traits: [
        {
          name: 'ingress',
          instanceName: 'my-ingress',
          config: {
            'http.path': '/api',
            'http.port': 8080,
          },
        },
      ],
    });

    expect(result.traits).toEqual([
      {
        name: 'ingress',
        instanceName: 'my-ingress',
        parameters: {
          http: { path: '/api', port: 8080 },
        },
      },
    ]);
  });
});

describe('buildWorkloadResource', () => {
  it('should build basic workload body with correct structure', () => {
    const result = buildWorkloadResource({
      containerImage: 'nginx:latest',
    });

    expect(result.containers.main.image).toBe('nginx:latest');
    expect(result.endpoints).toBeUndefined();
  });

  it('should add endpoint when port is provided', () => {
    const result = buildWorkloadResource({
      containerImage: 'nginx:latest',
      port: 8080,
    });

    expect(result.endpoints).toEqual({
      http: { type: 'HTTP', port: 8080 },
    });
  });

  it('should not add endpoint when port is not provided', () => {
    const result = buildWorkloadResource({
      containerImage: 'nginx:latest',
    });

    expect(result.endpoints).toBeUndefined();
  });
});
