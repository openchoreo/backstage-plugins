import {
  buildComponentResource,
  buildWorkloadResource,
  ComponentResourceInput,
} from './componentResourceBuilder';

describe('buildComponentResource', () => {
  const minimalInput: ComponentResourceInput = {
    componentName: 'my-service',
    namespaceName: 'default',
    projectName: 'my-project',
    componentType: 'service',
    componentTypeWorkloadType: 'deployment',
  };

  it('should build basic component resource with correct structure', () => {
    const result = buildComponentResource(minimalInput);

    expect(result.apiVersion).toBe('openchoreo.dev/v1alpha1');
    expect(result.kind).toBe('Component');
    expect(result.metadata.name).toBe('my-service');
    expect(result.metadata.namespace).toBe('default');
    expect(result.spec.owner.projectName).toBe('my-project');
    expect(result.spec.parameters).toEqual({});
    expect(result.spec.autoDeploy).toBe(false);
  });

  it('should format componentType as object with kind and name', () => {
    const result = buildComponentResource(minimalInput);
    expect(result.spec.componentType).toEqual({
      kind: 'ComponentType',
      name: 'deployment/service',
    });
  });

  it('should set display name and description annotations when provided', () => {
    const result = buildComponentResource({
      ...minimalInput,
      displayName: 'My Service',
      description: 'A test service',
    });

    expect(result.metadata.annotations!['openchoreo.dev/display-name']).toBe(
      'My Service',
    );
    expect(result.metadata.annotations!['openchoreo.dev/description']).toBe(
      'A test service',
    );
  });

  it('should not set display name or description annotations when not provided', () => {
    const result = buildComponentResource(minimalInput);

    expect(
      result.metadata.annotations!['openchoreo.dev/display-name'],
    ).toBeUndefined();
    expect(
      result.metadata.annotations!['openchoreo.dev/description'],
    ).toBeUndefined();
  });

  it('should include CTD parameters in spec.parameters', () => {
    const result = buildComponentResource({
      ...minimalInput,
      ctdParameters: { port: 8080, replicas: 3 },
    });

    expect(result.spec.parameters).toEqual({ port: 8080, replicas: 3 });
  });

  it('should set autoDeploy when provided', () => {
    const result = buildComponentResource({
      ...minimalInput,
      autoDeploy: true,
    });

    expect(result.spec.autoDeploy).toBe(true);
  });

  it('should default autoDeploy to false when not provided', () => {
    const result = buildComponentResource(minimalInput);
    expect(result.spec.autoDeploy).toBe(false);
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

      expect(result.spec.workflow).toBeDefined();
      expect(result.spec.workflow!.name).toBe('google-cloud-buildpacks');
      expect(result.spec.workflow!.parameters).toEqual({
        docker: {
          context: '/app',
          filePath: '/Dockerfile',
        },
      });
    });

    it('should inject git source fields at annotation-mapped paths in parameters', () => {
      const result = buildComponentResource({
        ...minimalInput,
        deploymentSource: 'build-from-source',
        workflowName: 'google-cloud-buildpacks',
        workflowParameters: {},
        repoUrl: 'https://github.com/org/repo.git',
        branch: 'develop',
        componentPath: 'services/api',
        workflowParameterMapping: {
          repoUrl: 'parameters.repository.url',
          branch: 'parameters.repository.revision.branch',
          appPath: 'parameters.repository.appPath',
        },
      });

      expect(result.spec.workflow!.parameters).toEqual({
        repository: {
          url: 'https://github.com/org/repo.git',
          revision: { branch: 'develop' },
          appPath: 'services/api',
        },
      });
    });

    it('should inject secretRef at annotation-mapped path when gitSecretRef is provided', () => {
      const result = buildComponentResource({
        ...minimalInput,
        deploymentSource: 'build-from-source',
        workflowName: 'google-cloud-buildpacks',
        workflowParameters: {},
        repoUrl: 'https://github.com/org/private-repo.git',
        branch: 'main',
        componentPath: '.',
        gitSecretRef: 'my-git-secret',
        workflowParameterMapping: {
          repoUrl: 'parameters.repository.url',
          branch: 'parameters.repository.revision.branch',
          appPath: 'parameters.repository.appPath',
          secretRef: 'parameters.repository.secretRef',
        },
      });

      expect(result.spec.workflow!.parameters).toEqual({
        repository: {
          url: 'https://github.com/org/private-repo.git',
          revision: { branch: 'main' },
          appPath: '.',
          secretRef: 'my-git-secret',
        },
      });
    });

    it('should not inject secretRef when gitSecretRef is not provided', () => {
      const result = buildComponentResource({
        ...minimalInput,
        deploymentSource: 'build-from-source',
        workflowName: 'google-cloud-buildpacks',
        workflowParameters: {},
        repoUrl: 'https://github.com/org/repo.git',
        branch: 'main',
        componentPath: '.',
        workflowParameterMapping: {
          repoUrl: 'parameters.repository.url',
          branch: 'parameters.repository.revision.branch',
          appPath: 'parameters.repository.appPath',
          secretRef: 'parameters.repository.secretRef',
        },
      });

      expect(
        result.spec.workflow!.parameters!.repository.secretRef,
      ).toBeUndefined();
    });

    it('should default branch to main and componentPath to . when not provided', () => {
      const result = buildComponentResource({
        ...minimalInput,
        deploymentSource: 'build-from-source',
        workflowName: 'google-cloud-buildpacks',
        workflowParameters: {},
        repoUrl: 'https://github.com/org/repo.git',
        workflowParameterMapping: {
          repoUrl: 'parameters.repository.url',
          branch: 'parameters.repository.revision.branch',
          appPath: 'parameters.repository.appPath',
        },
      });

      expect(result.spec.workflow!.parameters).toEqual({
        repository: {
          url: 'https://github.com/org/repo.git',
          revision: { branch: 'main' },
          appPath: '.',
        },
      });
    });

    it('should inject implicit scope fields (projectName, componentName) at annotation-mapped paths', () => {
      const result = buildComponentResource({
        ...minimalInput,
        deploymentSource: 'build-from-source',
        workflowName: 'google-cloud-buildpacks',
        workflowParameters: {
          'docker.context': '/app',
        },
        workflowParameterMapping: {
          projectName: 'parameters.scope.projectName',
          componentName: 'parameters.scope.componentName',
        },
      });

      expect(result.spec.workflow!.parameters).toEqual({
        docker: { context: '/app' },
        scope: {
          projectName: 'my-project',
          componentName: 'my-service',
        },
      });
    });

    it('should not inject git fields when no annotation mapping is provided', () => {
      const result = buildComponentResource({
        ...minimalInput,
        deploymentSource: 'build-from-source',
        workflowName: 'google-cloud-buildpacks',
        workflowParameters: {
          'docker.context': '/app',
        },
        repoUrl: 'https://github.com/org/repo.git',
        branch: 'main',
      });

      // Without mapping, git fields are not injected into parameters
      expect(result.spec.workflow!.parameters).toEqual({
        docker: { context: '/app' },
      });
    });
  });

  it('should not add workflow for deploy-from-image', () => {
    const result = buildComponentResource({
      ...minimalInput,
      deploymentSource: 'deploy-from-image',
      containerImage: 'nginx:latest',
    });

    expect(result.spec.workflow).toBeUndefined();
  });

  it('should not add workflow for external-ci', () => {
    const result = buildComponentResource({
      ...minimalInput,
      deploymentSource: 'external-ci',
    });

    expect(result.spec.workflow).toBeUndefined();
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

    expect(result.spec.traits).toEqual([
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
  it('should build basic workload resource with correct structure', () => {
    const result = buildWorkloadResource({
      componentName: 'my-service',
      namespaceName: 'default',
      projectName: 'my-project',
      containerImage: 'nginx:latest',
    });

    expect(result.apiVersion).toBe('openchoreo.dev/v1alpha1');
    expect(result.kind).toBe('Workload');
    expect(result.metadata.name).toBe('my-service-workload');
    expect(result.metadata.namespace).toBe('default');
    expect(result.spec.owner.projectName).toBe('my-project');
    expect(result.spec.owner.componentName).toBe('my-service');
    expect(result.spec.container?.image).toBe('nginx:latest');
    expect(result.spec.endpoints).toBeUndefined();
  });

  it('should add endpoint when port is provided', () => {
    const result = buildWorkloadResource({
      componentName: 'my-service',
      namespaceName: 'default',
      projectName: 'my-project',
      containerImage: 'nginx:latest',
      port: 8080,
    });

    expect(result.spec.endpoints).toEqual({
      http: { type: 'HTTP', port: 8080, visibility: ['external'] },
    });
  });

  it('should not add endpoint when port is not provided', () => {
    const result = buildWorkloadResource({
      componentName: 'my-service',
      namespaceName: 'default',
      projectName: 'my-project',
      containerImage: 'nginx:latest',
    });

    expect(result.spec.endpoints).toBeUndefined();
  });
});
