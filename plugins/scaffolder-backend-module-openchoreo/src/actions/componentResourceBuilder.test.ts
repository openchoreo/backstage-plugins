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
        workflow: { name: 'google-cloud-buildpacks' },
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
        workflow: { name: 'google-cloud-buildpacks' },
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
        workflow: { name: 'google-cloud-buildpacks' },
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
        workflow: { name: 'google-cloud-buildpacks' },
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
        workflow: { name: 'google-cloud-buildpacks' },
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
        workflow: { name: 'google-cloud-buildpacks' },
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
        workflow: { name: 'google-cloud-buildpacks' },
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

  it('should include env vars when image is provided', () => {
    const result = buildWorkloadResource({
      componentName: 'my-service',
      namespaceName: 'default',
      projectName: 'my-project',
      containerImage: 'nginx:latest',
      envVars: [
        { key: 'NODE_ENV', value: 'production' },
        {
          key: 'DB_PASSWORD',
          valueFrom: { secretKeyRef: { name: 'db-secret', key: 'password' } },
        },
      ],
    });

    expect(result.spec.container?.env).toEqual([
      { key: 'NODE_ENV', value: 'production' },
      {
        key: 'DB_PASSWORD',
        valueFrom: { secretKeyRef: { name: 'db-secret', key: 'password' } },
      },
    ]);
  });

  it('should include file mounts when image is provided', () => {
    const result = buildWorkloadResource({
      componentName: 'my-service',
      namespaceName: 'default',
      projectName: 'my-project',
      containerImage: 'nginx:latest',
      fileMounts: [{ key: 'config', mountPath: '/etc/config', value: 'data' }],
    });

    expect(result.spec.container?.files).toEqual([
      { key: 'config', mountPath: '/etc/config', value: 'data' },
    ]);
  });

  it('should omit container entirely when no image is provided', () => {
    const result = buildWorkloadResource({
      componentName: 'my-service',
      namespaceName: 'default',
      projectName: 'my-project',
      envVars: [{ key: 'FOO', value: 'bar' }],
    });

    expect(result.spec.container).toBeUndefined();
  });

  it('should use endpoints map over legacy port when both provided', () => {
    const result = buildWorkloadResource({
      componentName: 'my-service',
      namespaceName: 'default',
      projectName: 'my-project',
      containerImage: 'nginx:latest',
      port: 3000,
      endpoints: {
        grpc: { type: 'GRPC', port: 9090, visibility: ['internal'] } as any,
      },
    });

    // Endpoints map takes precedence over port
    expect(result.spec.endpoints).toEqual({
      grpc: { type: 'GRPC', port: 9090, visibility: ['internal'] },
    });
  });

  it('should not add empty endpoints map', () => {
    const result = buildWorkloadResource({
      componentName: 'my-service',
      namespaceName: 'default',
      projectName: 'my-project',
      containerImage: 'nginx:latest',
      endpoints: {},
    });

    expect(result.spec.endpoints).toBeUndefined();
  });

  it('should not include env vars or file mounts when empty arrays', () => {
    const result = buildWorkloadResource({
      componentName: 'my-service',
      namespaceName: 'default',
      projectName: 'my-project',
      containerImage: 'nginx:latest',
      envVars: [],
      fileMounts: [],
    });

    expect(result.spec.container?.env).toBeUndefined();
    expect(result.spec.container?.files).toBeUndefined();
  });
});

describe('buildComponentResource – additional cases', () => {
  const minimalInput: ComponentResourceInput = {
    componentName: 'my-service',
    namespaceName: 'default',
    projectName: 'my-project',
    componentType: 'service',
    componentTypeWorkloadType: 'deployment',
  };

  it('should use ClusterComponentType kind when specified', () => {
    const result = buildComponentResource({
      ...minimalInput,
      componentTypeKind: 'ClusterComponentType',
    });

    expect(result.spec.componentType.kind).toBe('ClusterComponentType');
  });

  it('should default componentType kind to ComponentType', () => {
    const result = buildComponentResource(minimalInput);
    expect(result.spec.componentType.kind).toBe('ComponentType');
  });

  it('should handle workflow with explicit kind', () => {
    const result = buildComponentResource({
      ...minimalInput,
      deploymentSource: 'build-from-source',
      workflow: { kind: 'ClusterWorkflow', name: 'docker-build' },
      workflowParameters: {},
    });

    expect(result.spec.workflow!.kind).toBe('ClusterWorkflow');
    expect(result.spec.workflow!.name).toBe('docker-build');
  });

  it('should handle traits with explicit kind', () => {
    const result = buildComponentResource({
      ...minimalInput,
      traits: [
        {
          kind: 'ClusterTrait',
          name: 'autoscaler',
          instanceName: 'my-autoscaler',
          config: { 'scaling.minReplicas': 2, 'scaling.maxReplicas': 10 },
        },
      ],
    });

    expect(result.spec.traits).toEqual([
      {
        kind: 'ClusterTrait',
        name: 'autoscaler',
        instanceName: 'my-autoscaler',
        parameters: {
          scaling: { minReplicas: 2, maxReplicas: 10 },
        },
      },
    ]);
  });

  it('should omit trait kind when undefined', () => {
    const result = buildComponentResource({
      ...minimalInput,
      traits: [
        {
          name: 'ingress',
          instanceName: 'my-ingress',
          config: { path: '/api' },
        },
      ],
    });

    expect(result.spec.traits![0]).not.toHaveProperty('kind');
  });

  it('should protect against prototype pollution in workflow parameters', () => {
    const result = buildComponentResource({
      ...minimalInput,
      deploymentSource: 'build-from-source',
      workflow: { name: 'test-build' },
      workflowParameters: {
        '__proto__.polluted': 'yes',
        'constructor.polluted': 'yes',
        'safe.key': 'value',
      },
    });

    // Safe key should be set
    expect(result.spec.workflow!.parameters!.safe.key).toBe('value');
    // Prototype pollution should not occur
    expect(({} as any).polluted).toBeUndefined();
  });

  it('should protect against prototype pollution in annotation-mapped paths', () => {
    buildComponentResource({
      ...minimalInput,
      deploymentSource: 'build-from-source',
      workflow: { name: 'test-build' },
      workflowParameters: {},
      repoUrl: 'https://github.com/org/repo.git',
      workflowParameterMapping: {
        repoUrl: 'parameters.__proto__.polluted',
      },
    });

    // Prototype pollution should not occur
    expect(({} as any).polluted).toBeUndefined();
  });
});
