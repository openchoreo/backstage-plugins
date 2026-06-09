import {
  CtdToTemplateConverter,
  ComponentType,
} from './CtdToTemplateConverter';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

describe('CtdToTemplateConverter', () => {
  let converter: CtdToTemplateConverter;

  beforeEach(() => {
    converter = new CtdToTemplateConverter({
      defaultOwner: 'test-owner',
    });
  });

  describe('convertCtdToTemplateEntity', () => {
    it('should convert a basic CTD to a template entity', () => {
      const ctd: ComponentType = {
        metadata: {
          workloadType: 'deployment',
          createdAt: '2025-01-01T00:00:00Z',
          name: 'simple-service',
          displayName: 'Simple Service',
          description: 'A simple service for testing',
          tags: ['test', 'simple'],
        },
        spec: {
          inputParametersSchema: {
            type: 'object',
            properties: {
              port: {
                type: 'integer',
                title: 'Port',
                description: 'Service port',
                default: 8080,
              },
            },
            required: ['port'],
          },
        },
      };

      const result = converter.convertCtdToTemplateEntity(ctd, 'test-org');

      // Check basic structure
      expect(result.apiVersion).toBe('scaffolder.backstage.io/v1beta3');
      expect(result.kind).toBe('Template');

      // Check metadata
      expect(result.metadata.name).toBe('template-simple-service');
      expect(result.metadata.namespace).toBe('test-org');
      expect(result.metadata.title).toBe('Simple Service');
      expect(result.metadata.description).toBe('A simple service for testing');
      // Tags are not generated (tag inference was removed)
      expect(result.metadata.tags).toBeUndefined();

      // Check annotations
      expect(result.metadata.annotations?.[CHOREO_ANNOTATIONS.CTD_NAME]).toBe(
        'simple-service',
      );
      expect(
        result.metadata.annotations?.[CHOREO_ANNOTATIONS.CTD_GENERATED],
      ).toBe('true');
      expect(
        result.metadata.annotations?.[CHOREO_ANNOTATIONS.CTD_DISPLAY_NAME],
      ).toBe('Simple Service');

      // Check spec
      expect(result.spec?.owner).toBe('test-owner');
      expect(result.spec?.type).toBe('Component');
      expect(result.spec?.parameters).toBeDefined();
      expect(result.spec?.steps).toBeDefined();
    });

    it('should generate default title from CTD name when displayName is not provided', () => {
      const ctd: ComponentType = {
        metadata: {
          workloadType: 'deployment',
          createdAt: '2025-01-01T00:00:00Z',
          name: 'web-service',
        },
        spec: {
          inputParametersSchema: {
            type: 'object',
            properties: {},
          },
        },
      };

      const result = converter.convertCtdToTemplateEntity(ctd, 'test-org');

      expect(result.metadata.title).toBe('Web Service');
      expect(result.metadata.description).toBe(
        'Create a Web Service component',
      );
    });

    it('should handle CTD without tags', () => {
      const ctd: ComponentType = {
        metadata: {
          workloadType: 'deployment',
          createdAt: '2025-01-01T00:00:00Z',
          name: 'simple-service',
        },
        spec: {
          inputParametersSchema: {
            type: 'object',
            properties: {},
          },
        },
      };

      const result = converter.convertCtdToTemplateEntity(ctd, 'test-org');

      // Tags are not generated (tag inference was removed)
      expect(result.metadata.tags).toBeUndefined();
    });
  });

  describe('generateParameters', () => {
    it('should generate 3 sections: Component Metadata, Build & Deploy, <DisplayName> Details', () => {
      const ctd: ComponentType = {
        metadata: {
          workloadType: 'deployment',
          createdAt: '2025-01-01T00:00:00Z',
          name: 'test-service',
        },
        spec: {
          inputParametersSchema: {
            type: 'object',
            properties: {},
          },
        },
      };

      const result = converter.convertCtdToTemplateEntity(ctd, 'test-org');
      const parameters = result.spec?.parameters as any[];

      // Always 3 sections
      expect(parameters).toHaveLength(3);

      // Section 1: Component Metadata
      expect(parameters[0].title).toBe('Component Metadata');
      expect(parameters[0].required).toEqual([
        'project_namespace',
        'component_name',
      ]);
      expect(parameters[0].properties.component_name).toBeDefined();
      expect(parameters[0].properties.project_namespace).toBeDefined();
      expect(parameters[0].properties.displayName).toBeDefined();
      expect(parameters[0].properties.description).toBeDefined();

      // Check UI fields
      expect(parameters[0].properties.component_name['ui:field']).toBe(
        'ComponentNamePicker',
      );
      expect(parameters[0].properties.project_namespace['ui:field']).toBe(
        'ProjectNamespaceField',
      );

      // Section 2: Build & Deploy
      expect(parameters[1].title).toBe('Build & Deploy');

      // Section 3: Dynamic title based on displayName/name
      expect(parameters[2].title).toBe('Test Service Details');
    });

    it('should generate Workload Details section with WorkloadDetailsField', () => {
      const ctd: ComponentType = {
        metadata: {
          workloadType: 'deployment',
          createdAt: '2025-01-01T00:00:00Z',
          name: 'web-service',
          displayName: 'Web Service',
        },
        spec: {
          inputParametersSchema: {
            type: 'object',
            required: ['port'],
            properties: {
              port: {
                type: 'integer',
                title: 'Port',
                default: 8080,
              },
            },
          },
        },
      };

      const result = converter.convertCtdToTemplateEntity(ctd, 'test-org');
      const parameters = result.spec?.parameters as any[];

      // Section 3: Dynamic title based on displayName
      const workloadSection = parameters[2];
      expect(workloadSection.title).toBe('Web Service Details');

      // Check it uses WorkloadDetailsField
      const workloadDetails = workloadSection.properties.workloadDetails;
      expect(workloadDetails).toBeDefined();
      expect(workloadDetails['ui:field']).toBe('WorkloadDetailsField');
      expect(workloadDetails.type).toBe('object');

      // Check ui:options
      const options = workloadDetails['ui:options'];
      expect(options.namespaceName).toBe('test-org');
      expect(options.workloadType).toBe('deployment');
      expect(options.ctdDisplayName).toBe('Web Service');

      // Check CTD schema is passed through
      expect(options.ctdSchema).toBeDefined();
      expect(options.ctdSchema.properties.port).toBeDefined();
      expect(options.ctdSchema.properties.port.type).toBe('integer');
      expect(options.ctdSchema.required).toEqual(['port']);

      // workloadDetails should not have properties (custom ComponentReview handles display)
      expect(workloadDetails.properties).toBeUndefined();
    });

    it('should pass workloadType in ui:options for conditional endpoint rendering', () => {
      const deploymentCtd: ComponentType = {
        metadata: {
          workloadType: 'deployment/service',
          createdAt: '2025-01-01T00:00:00Z',
          name: 'web-service',
        },
        spec: {
          inputParametersSchema: {
            type: 'object',
            properties: {},
          },
        },
      };

      const cronjobCtd: ComponentType = {
        metadata: {
          workloadType: 'cronjob',
          createdAt: '2025-01-01T00:00:00Z',
          name: 'batch-job',
        },
        spec: {
          inputParametersSchema: {
            type: 'object',
            properties: {},
          },
        },
      };

      const deployResult = converter.convertCtdToTemplateEntity(
        deploymentCtd,
        'test-org',
      );
      const deployParams = deployResult.spec?.parameters as any[];
      expect(
        deployParams[2].properties.workloadDetails['ui:options'].workloadType,
      ).toBe('deployment/service');

      const cronjobResult = converter.convertCtdToTemplateEntity(
        cronjobCtd,
        'test-org',
      );
      const cronjobParams = cronjobResult.spec?.parameters as any[];
      expect(
        cronjobParams[2].properties.workloadDetails['ui:options'].workloadType,
      ).toBe('cronjob');
    });

    it('should generate ctdDisplayName from name when displayName is not provided', () => {
      const ctd: ComponentType = {
        metadata: {
          workloadType: 'deployment',
          createdAt: '2025-01-01T00:00:00Z',
          name: 'web-service',
        },
        spec: {
          inputParametersSchema: {
            type: 'object',
            properties: {},
          },
        },
      };

      const result = converter.convertCtdToTemplateEntity(ctd, 'test-org');
      const parameters = result.spec?.parameters as any[];
      const options = parameters[2].properties.workloadDetails['ui:options'];

      expect(options.ctdDisplayName).toBe('Web Service');
    });

    it('should generate Build & Deploy section with deployment source options when CTD has allowedWorkflows', () => {
      const ctd: ComponentType = {
        metadata: {
          workloadType: 'deployment',
          createdAt: '2025-01-01T00:00:00Z',
          name: 'web-service',
          displayName: 'Web Service',
          allowedWorkflows: ['nodejs-build', 'docker-build'],
        },
        spec: {
          inputParametersSchema: {
            type: 'object',
            properties: {
              port: {
                type: 'integer',
                title: 'Port',
                default: 8080,
              },
            },
          },
        },
      };

      const result = converter.convertCtdToTemplateEntity(ctd, 'test-org');
      const parameters = result.spec?.parameters as any[];

      // Should have 3 sections
      expect(parameters).toHaveLength(3);

      // Check Build & Deploy section (second section). All branch-specific
      // fields now live as siblings of `deploymentSource` under a single
      // `buildAndDeploy` object owned by BuildAndDeployField — the composite
      // field is the only way to atomically clear the inactive branch's data
      // on source change.
      const buildDeploySection = parameters[1];
      expect(buildDeploySection.title).toBe('Build & Deploy');
      expect(buildDeploySection.required).toEqual(['buildAndDeploy']);

      const buildAndDeploy = buildDeploySection.properties.buildAndDeploy;
      expect(buildAndDeploy).toBeDefined();
      expect(buildAndDeploy.type).toBe('object');
      expect(buildAndDeploy['ui:field']).toBe('BuildAndDeployField');
      expect(buildAndDeploy.required).toEqual(['deploymentSource']);

      // deploymentSource still rendered by DeploymentSourcePicker
      expect(buildAndDeploy.properties.deploymentSource).toBeDefined();
      expect(buildAndDeploy.properties.deploymentSource.type).toBe('string');
      expect(buildAndDeploy.properties.deploymentSource.enum).toEqual([
        'build-from-source',
        'deploy-from-image',
        'external-ci',
      ]);
      expect(buildAndDeploy.properties.deploymentSource['ui:field']).toBe(
        'DeploymentSourcePicker',
      );

      // Build-from-source siblings
      expect(buildAndDeploy.properties.git_source).toBeDefined();
      expect(buildAndDeploy.properties.git_source.type).toBe('object');
      expect(buildAndDeploy.properties.git_source['ui:field']).toBe(
        'GitSourceField',
      );
      expect(
        buildAndDeploy.properties.git_source.properties.repo_url,
      ).toBeDefined();
      expect(
        buildAndDeploy.properties.git_source.properties.branch,
      ).toBeDefined();
      expect(
        buildAndDeploy.properties.git_source.properties.component_path,
      ).toBeDefined();
      expect(
        buildAndDeploy.properties.git_source.properties.git_secret_ref,
      ).toBeDefined();

      expect(buildAndDeploy.properties.workflow_name).toBeDefined();
      expect(buildAndDeploy.properties.workflow_parameters).toBeDefined();

      // workflow_name still passes allowedWorkflows via ui:options
      expect(
        buildAndDeploy.properties.workflow_name['ui:options'].allowedWorkflows,
      ).toEqual([
        { kind: 'Workflow', name: 'nodejs-build' },
        { kind: 'Workflow', name: 'docker-build' },
      ]);
      expect(buildAndDeploy.properties.workflow_name['ui:field']).toBe(
        'BuildWorkflowPicker',
      );

      // workflow_parameters still uses custom UI field
      expect(buildAndDeploy.properties.workflow_parameters['ui:field']).toBe(
        'BuildWorkflowParameters',
      );

      // Deploy-from-image siblings
      expect(buildAndDeploy.properties.containerImage).toBeDefined();
      expect(buildAndDeploy.properties.containerImage['ui:field']).toBe(
        'ContainerImageField',
      );
      expect(buildAndDeploy.properties.autoDeploy).toBeDefined();
    });

    it('should encode mixed Workflow and ClusterWorkflow allowedWorkflows with correct kind', () => {
      const ctd: ComponentType = {
        metadata: {
          workloadType: 'deployment',
          createdAt: '2025-01-01T00:00:00Z',
          name: 'web-service',
          displayName: 'Web Service',
          allowedWorkflows: [
            'nodejs-build',
            { kind: 'ClusterWorkflow', name: 'dockerfile-builder' },
          ] as any,
        },
        spec: {
          inputParametersSchema: {
            type: 'object',
            properties: {},
          },
        },
      };

      const result = converter.convertCtdToTemplateEntity(ctd, 'test-org');
      const parameters = result.spec?.parameters as any[];
      const buildAndDeploy = parameters[1].properties.buildAndDeploy;

      expect(
        buildAndDeploy.properties.workflow_name['ui:options'].allowedWorkflows,
      ).toEqual([
        { kind: 'Workflow', name: 'nodejs-build' },
        { kind: 'ClusterWorkflow', name: 'dockerfile-builder' },
      ]);
    });

    it('should still have 3 sections when CTD has no allowedWorkflows', () => {
      const ctd: ComponentType = {
        metadata: {
          workloadType: 'deployment',
          createdAt: '2025-01-01T00:00:00Z',
          name: 'web-service',
          displayName: 'Web Service',
          // No allowedWorkflows - means no CI support
        },
        spec: {
          inputParametersSchema: {
            type: 'object',
            properties: {
              port: {
                type: 'integer',
                title: 'Port',
                default: 8080,
              },
            },
          },
        },
      };

      const result = converter.convertCtdToTemplateEntity(ctd, 'test-org');
      const parameters = result.spec?.parameters as any[];

      // Should have 3 sections: Component Metadata, Build & Deploy, Workload Details
      expect(parameters).toHaveLength(3);

      // Verify section order
      expect(parameters[0].title).toBe('Component Metadata');
      expect(parameters[1].title).toBe('Build & Deploy');
      expect(parameters[2].title).toBe('Web Service Details');
    });

    it('should pass empty/undefined CTD schema when no input parameters', () => {
      const ctd: ComponentType = {
        metadata: {
          workloadType: 'deployment',
          createdAt: '2025-01-01T00:00:00Z',
          name: 'minimal-service',
        },
        spec: {
          inputParametersSchema: {
            type: 'object',
            properties: {},
          },
        },
      };

      const result = converter.convertCtdToTemplateEntity(ctd, 'test-org');
      const parameters = result.spec?.parameters as any[];

      // Should still have 3 sections
      expect(parameters).toHaveLength(3);

      // Workload Details section should have the CTD schema in ui:options
      const options = parameters[2].properties.workloadDetails['ui:options'];
      expect(options.ctdSchema).toBeDefined();
      expect(options.ctdSchema.properties).toEqual({});
    });
  });

  describe('generateSteps', () => {
    it('should generate scaffolder steps with correct action', () => {
      const ctd: ComponentType = {
        metadata: {
          workloadType: 'deployment',
          createdAt: '2025-01-01T00:00:00Z',
          name: 'test-service',
        },
        spec: {
          inputParametersSchema: {
            type: 'object',
            properties: {},
          },
        },
      };

      const result = converter.convertCtdToTemplateEntity(ctd, 'test-org');
      const steps = result.spec?.steps as any[];

      expect(steps).toHaveLength(1);
      expect(steps[0].id).toBe('create-component');
      expect(steps[0].name).toBe('Create OpenChoreo Component');
      expect(steps[0].action).toBe('openchoreo:component:create');
    });

    it('should pass parameters to scaffolder action with workloadDetails', () => {
      const ctd: ComponentType = {
        metadata: {
          workloadType: 'deployment',
          createdAt: '2025-01-01T00:00:00Z',
          name: 'web-service',
        },
        spec: {
          inputParametersSchema: {
            type: 'object',
            properties: {
              port: { type: 'integer' },
            },
          },
        },
      };

      const result = converter.convertCtdToTemplateEntity(ctd, 'test-org');
      const steps = result.spec?.steps as any[];
      const input = steps[0].input;

      // Component metadata parameters
      expect(input.namespaceName).toBe(
        '${{ parameters.project_namespace.namespace_name }}',
      );
      expect(input.projectName).toBe(
        '${{ parameters.project_namespace.project_name }}',
      );
      expect(input.componentName).toBe('${{ parameters.component_name }}');
      expect(input.displayName).toBe('${{ parameters.displayName }}');
      expect(input.description).toBe('${{ parameters.description }}');
      expect(input.componentType).toBe('web-service');

      // Workload details as nested object
      expect(input.workloadDetails).toBe('${{ parameters.workloadDetails }}');

      // CI/CD parameters including git secret ref (from git_source composite field)
      // All CI/CD fields are nested under buildAndDeploy after the BuildAndDeployField restructure.
      expect(input.gitSecretRef).toBe(
        '${{ parameters.buildAndDeploy.git_source.git_secret_ref }}',
      );
      expect(input.repo_url).toBe(
        '${{ parameters.buildAndDeploy.git_source.repo_url }}',
      );
      expect(input.branch).toBe(
        '${{ parameters.buildAndDeploy.git_source.branch }}',
      );
      expect(input.component_path).toBe(
        '${{ parameters.buildAndDeploy.git_source.component_path }}',
      );
    });
  });

  describe('edge cases', () => {
    it('should handle CTD with additionalProperties', () => {
      const ctd: ComponentType = {
        metadata: {
          workloadType: 'deployment',
          createdAt: '2025-01-01T00:00:00Z',
          name: 'flexible-service',
        },
        spec: {
          inputParametersSchema: {
            type: 'object',
            properties: {
              config: {
                type: 'object',
                additionalProperties: {
                  type: 'string',
                },
              },
            },
          },
        },
      };

      const result = converter.convertCtdToTemplateEntity(ctd, 'test-org');
      const parameters = result.spec?.parameters as any[];

      // CTD schema is now embedded in ui:options.ctdSchema
      const ctdSchema =
        parameters[2].properties.workloadDetails['ui:options'].ctdSchema;
      expect(ctdSchema.properties.config.additionalProperties.type).toBe(
        'string',
      );
    });

    it('should use default config when not provided', () => {
      const converterWithDefaults = new CtdToTemplateConverter();
      const ctd: ComponentType = {
        metadata: {
          workloadType: 'deployment',
          createdAt: '2025-01-01T00:00:00Z',
          name: 'test',
        },
        spec: {
          inputParametersSchema: {
            type: 'object',
            properties: {},
          },
        },
      };

      const result = converterWithDefaults.convertCtdToTemplateEntity(
        ctd,
        'test-org',
      );

      expect(result.spec?.owner).toBe('guests');
      expect(result.metadata.namespace).toBe('test-org');
    });
  });

  describe('external-ci and ciPlatform conditional fields', () => {
    const baseCtd: ComponentType = {
      metadata: {
        workloadType: 'deployment',
        createdAt: '2025-01-01T00:00:00Z',
        name: 'web-service',
        allowedWorkflows: ['docker-build'],
      },
      spec: {
        inputParametersSchema: {
          type: 'object',
          properties: {},
        },
      },
    };

    it('should expose external-ci as an option with a ciPlatform sibling', () => {
      const result = converter.convertCtdToTemplateEntity(baseCtd, 'test-org');
      const parameters = result.spec?.parameters as any[];
      const buildAndDeploy = parameters[1].properties.buildAndDeploy;

      expect(buildAndDeploy.properties.deploymentSource.enum).toContain(
        'external-ci',
      );
      expect(buildAndDeploy.properties.ciPlatform).toBeDefined();
      expect(buildAndDeploy.properties.ciPlatform.enum).toEqual([
        'none',
        'jenkins',
        'github-actions',
        'gitlab-ci',
      ]);
      // The composite renders ciIdentifier only when ciPlatform requires it;
      // the schema carries a generic shape and the picker labels it per platform.
      expect(buildAndDeploy.properties.ciIdentifier).toBeDefined();
      expect(buildAndDeploy.properties.ciIdentifier.type).toBe('string');
    });
  });

  describe('allowedTraits passthrough', () => {
    it('should pass allowedTraits to WorkloadDetailsField ui:options', () => {
      const ctd: ComponentType = {
        metadata: {
          workloadType: 'deployment',
          createdAt: '2025-01-01T00:00:00Z',
          name: 'web-service',
          allowedTraits: [
            { kind: 'Trait', name: 'ingress' },
            { kind: 'Trait', name: 'hpa' },
          ],
        },
        spec: {
          inputParametersSchema: {
            type: 'object',
            properties: {},
          },
        },
      };

      const result = converter.convertCtdToTemplateEntity(ctd, 'test-org');
      const parameters = result.spec?.parameters as any[];
      const options = parameters[2].properties.workloadDetails['ui:options'];

      expect(options.allowedTraits).toEqual([
        { kind: 'Trait', name: 'ingress' },
        { kind: 'Trait', name: 'hpa' },
      ]);
    });

    it('should pass undefined allowedTraits when not set', () => {
      const ctd: ComponentType = {
        metadata: {
          workloadType: 'deployment',
          createdAt: '2025-01-01T00:00:00Z',
          name: 'web-service',
        },
        spec: {
          inputParametersSchema: {
            type: 'object',
            properties: {},
          },
        },
      };

      const result = converter.convertCtdToTemplateEntity(ctd, 'test-org');
      const parameters = result.spec?.parameters as any[];
      const options = parameters[2].properties.workloadDetails['ui:options'];

      expect(options.allowedTraits).toBeUndefined();
    });
  });
});
