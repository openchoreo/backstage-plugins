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
      namespace: 'test-namespace',
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
      expect(result.metadata.name).toBe(
        'template-test-namespace-simple-service',
      );
      expect(result.metadata.namespace).toBe('test-namespace');
      expect(result.metadata.title).toBe('Simple Service');
      expect(result.metadata.description).toBe('A simple service for testing');
      // Tags include inferred tags from name and workloadType
      expect(result.metadata.tags).toEqual([
        'openchoreo',
        'simple-service',
        'deployment',
        'test',
        'simple',
      ]);

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

      // Even without explicit tags, should have inferred tags from name and workloadType
      expect(result.metadata.tags).toEqual([
        'openchoreo',
        'simple-service',
        'deployment',
      ]);
    });
  });

  describe('generateParameters', () => {
    it('should generate 3 sections: Build & Deploy, Workload Details, Component Metadata', () => {
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

      // Section 1: Build & Deploy
      expect(parameters[0].title).toBe('Build & Deploy');

      // Section 2: Workload Details
      expect(parameters[1].title).toBe('Workload Details');

      // Section 3: Component Metadata
      expect(parameters[2].title).toBe('Component Metadata');
      expect(parameters[2].required).toEqual([
        'project_namespace',
        'component_name',
      ]);
      expect(parameters[2].properties.component_name).toBeDefined();
      expect(parameters[2].properties.project_namespace).toBeDefined();
      expect(parameters[2].properties.displayName).toBeDefined();
      expect(parameters[2].properties.description).toBeDefined();

      // Check UI fields
      expect(parameters[2].properties.component_name['ui:field']).toBe(
        'ComponentNamePicker',
      );
      expect(parameters[2].properties.project_namespace['ui:field']).toBe(
        'ProjectNamespaceField',
      );
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

      // Section 2: Workload Details
      const workloadSection = parameters[1];
      expect(workloadSection.title).toBe('Workload Details');

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
        deployParams[1].properties.workloadDetails['ui:options'].workloadType,
      ).toBe('deployment/service');

      const cronjobResult = converter.convertCtdToTemplateEntity(
        cronjobCtd,
        'test-org',
      );
      const cronjobParams = cronjobResult.spec?.parameters as any[];
      expect(
        cronjobParams[1].properties.workloadDetails['ui:options'].workloadType,
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
      const options = parameters[1].properties.workloadDetails['ui:options'];

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

      // Check Build & Deploy section (first section)
      const buildDeploySection = parameters[0];
      expect(buildDeploySection.title).toBe('Build & Deploy');
      expect(buildDeploySection.required).toEqual(['deploymentSource']);

      // Check deploymentSource property
      expect(buildDeploySection.properties.deploymentSource).toBeDefined();
      expect(buildDeploySection.properties.deploymentSource.type).toBe(
        'string',
      );
      expect(buildDeploySection.properties.deploymentSource.enum).toEqual([
        'build-from-source',
        'deploy-from-image',
        'external-ci',
      ]);
      expect(buildDeploySection.properties.deploymentSource['ui:field']).toBe(
        'DeploymentSourcePicker',
      );

      // autoDeploy is NOT a top-level property — it's in each oneOf branch (at the bottom)
      expect(buildDeploySection.properties.autoDeploy).toBeUndefined();

      // Check dependencies structure uses oneOf
      expect(buildDeploySection.dependencies.deploymentSource).toBeDefined();
      expect(
        buildDeploySection.dependencies.deploymentSource.oneOf,
      ).toBeDefined();
      expect(
        buildDeploySection.dependencies.deploymentSource.oneOf,
      ).toHaveLength(3);

      // Check build-from-source branch
      const buildFromSourceBranch =
        buildDeploySection.dependencies.deploymentSource.oneOf[0];
      expect(buildFromSourceBranch.properties.deploymentSource.const).toBe(
        'build-from-source',
      );

      // Check git_source composite field
      expect(buildFromSourceBranch.properties.git_source).toBeDefined();
      expect(buildFromSourceBranch.properties.git_source.type).toBe('object');
      expect(buildFromSourceBranch.properties.git_source['ui:field']).toBe(
        'GitSourceField',
      );
      expect(
        buildFromSourceBranch.properties.git_source.properties.repo_url,
      ).toBeDefined();
      expect(
        buildFromSourceBranch.properties.git_source.properties.branch,
      ).toBeDefined();
      expect(
        buildFromSourceBranch.properties.git_source.properties.component_path,
      ).toBeDefined();
      expect(
        buildFromSourceBranch.properties.git_source.properties.git_secret_ref,
      ).toBeDefined();

      expect(buildFromSourceBranch.properties.workflow_name).toBeDefined();
      expect(
        buildFromSourceBranch.properties.workflow_parameters,
      ).toBeDefined();

      // Check workflow_name has enum from allowedWorkflows
      expect(buildFromSourceBranch.properties.workflow_name.enum).toEqual([
        'nodejs-build',
        'docker-build',
      ]);
      expect(buildFromSourceBranch.properties.workflow_name['ui:field']).toBe(
        'BuildWorkflowPicker',
      );

      // Check workflow_parameters uses custom UI field
      expect(
        buildFromSourceBranch.properties.workflow_parameters['ui:field'],
      ).toBe('BuildWorkflowParameters');

      // Check autoDeploy appears in build-from-source branch
      expect(buildFromSourceBranch.properties.autoDeploy).toBeDefined();
      expect(buildFromSourceBranch.properties.autoDeploy.type).toBe('boolean');
      expect(buildFromSourceBranch.properties.autoDeploy['ui:field']).toBe(
        'SwitchField',
      );

      // Check required fields for build-from-source
      expect(buildFromSourceBranch.required).toEqual([
        'workflow_name',
        'workflow_parameters',
      ]);

      // Check deploy-from-image branch
      const deployFromImageBranch =
        buildDeploySection.dependencies.deploymentSource.oneOf[1];
      expect(deployFromImageBranch.properties.deploymentSource.const).toBe(
        'deploy-from-image',
      );
      expect(deployFromImageBranch.properties.containerImage).toBeDefined();
      expect(deployFromImageBranch.properties.containerImage['ui:field']).toBe(
        'ContainerImageField',
      );
      // Check autoDeploy appears in deploy-from-image branch
      expect(deployFromImageBranch.properties.autoDeploy).toBeDefined();

      // Check required fields for deploy-from-image
      expect(deployFromImageBranch.required).toEqual(['containerImage']);
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

      // Should have 3 sections: Build & Deploy, Workload Details, Component Metadata
      expect(parameters).toHaveLength(3);

      // Verify section order
      expect(parameters[0].title).toBe('Build & Deploy');
      expect(parameters[1].title).toBe('Workload Details');
      expect(parameters[2].title).toBe('Component Metadata');
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
      const options = parameters[1].properties.workloadDetails['ui:options'];
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
      expect(input.gitSecretRef).toBe(
        '${{ parameters.git_source.git_secret_ref }}',
      );
      expect(input.repo_url).toBe('${{ parameters.git_source.repo_url }}');
      expect(input.branch).toBe('${{ parameters.git_source.branch }}');
      expect(input.component_path).toBe(
        '${{ parameters.git_source.component_path }}',
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
        parameters[1].properties.workloadDetails['ui:options'].ctdSchema;
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
      expect(result.metadata.namespace).toBe('openchoreo');
    });
  });
});
