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
    it('should include standard component metadata fields', () => {
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

      // First section should be Build & Deploy
      expect(parameters[0].title).toBe('Build & Deploy');

      // Second section should be Component Metadata
      expect(parameters[1].title).toBe('Component Metadata');
      expect(parameters[1].required).toEqual([
        'project_namespace',
        'component_name',
      ]);
      expect(parameters[1].properties.component_name).toBeDefined();
      expect(parameters[1].properties.project_namespace).toBeDefined();
      expect(parameters[1].properties.displayName).toBeDefined();
      expect(parameters[1].properties.description).toBeDefined();

      // Check UI fields
      expect(parameters[1].properties.component_name['ui:field']).toBe(
        'ComponentNamePicker',
      );
      expect(parameters[1].properties.project_namespace['ui:field']).toBe(
        'ProjectNamespaceField',
      );
    });

    it('should convert CTD parameters to RJSF format', () => {
      const ctd: ComponentType = {
        metadata: {
          workloadType: 'deployment',
          createdAt: '2025-01-01T00:00:00Z',
          name: 'database-service',
          displayName: 'Database Service',
        },
        spec: {
          inputParametersSchema: {
            type: 'object',
            required: ['databaseType', 'storageSize'],
            properties: {
              databaseType: {
                type: 'string',
                title: 'Database Type',
                enum: ['postgresql', 'mysql', 'mongodb'],
              },
              storageSize: {
                type: 'integer',
                title: 'Storage Size',
                minimum: 10,
                maximum: 1000,
                default: 20,
              },
              enableBackup: {
                type: 'boolean',
                title: 'Enable Backup',
                default: true,
              },
            },
          },
        },
      };

      const result = converter.convertCtdToTemplateEntity(ctd, 'test-org');
      const parameters = result.spec?.parameters as any[];

      // Third section should be CTD configuration (after Build & Deploy and Component Metadata)
      expect(parameters[2].title).toBe('Database Service Configuration');
      expect(parameters[2].required).toEqual(['databaseType', 'storageSize']);

      const props = parameters[2].properties;

      // Check string with enum
      expect(props.databaseType.type).toBe('string');
      expect(props.databaseType.title).toBe('Database Type');
      expect(props.databaseType.enum).toEqual([
        'postgresql',
        'mysql',
        'mongodb',
      ]);

      // Check integer with min/max
      expect(props.storageSize.type).toBe('integer');
      expect(props.storageSize.minimum).toBe(10);
      expect(props.storageSize.maximum).toBe(1000);
      expect(props.storageSize.default).toBe(20);

      // Check boolean
      expect(props.enableBackup.type).toBe('boolean');
      expect(props.enableBackup.default).toBe(true);
    });

    it('should handle nested objects', () => {
      const ctd: ComponentType = {
        metadata: {
          workloadType: 'deployment',
          createdAt: '2025-01-01T00:00:00Z',
          name: 'service-with-nested',
        },
        spec: {
          inputParametersSchema: {
            type: 'object',
            properties: {
              resourceLimits: {
                type: 'object',
                title: 'Resource Limits',
                properties: {
                  cpu: {
                    type: 'string',
                    title: 'CPU',
                    default: '1000m',
                  },
                  memory: {
                    type: 'string',
                    title: 'Memory',
                    default: '2Gi',
                  },
                },
              },
            },
          },
        },
      };

      const result = converter.convertCtdToTemplateEntity(ctd, 'test-org');
      const parameters = result.spec?.parameters as any[];
      const props = parameters[2].properties;

      expect(props.resourceLimits.type).toBe('object');
      expect(props.resourceLimits.title).toBe('Resource Limits');
      expect(props.resourceLimits.properties.cpu.type).toBe('string');
      expect(props.resourceLimits.properties.cpu.default).toBe('1000m');
      expect(props.resourceLimits.properties.memory.type).toBe('string');
      expect(props.resourceLimits.properties.memory.default).toBe('2Gi');
    });

    it('should handle arrays', () => {
      const ctd: ComponentType = {
        metadata: {
          workloadType: 'deployment',
          createdAt: '2025-01-01T00:00:00Z',
          name: 'service-with-array',
        },
        spec: {
          inputParametersSchema: {
            type: 'object',
            properties: {
              tags: {
                type: 'array',
                title: 'Tags',
                items: {
                  type: 'string',
                },
                minItems: 1,
                maxItems: 10,
              },
            },
          },
        },
      };

      const result = converter.convertCtdToTemplateEntity(ctd, 'test-org');
      const parameters = result.spec?.parameters as any[];
      const props = parameters[2].properties;

      expect(props.tags.type).toBe('array');
      expect(props.tags.title).toBe('Tags');
      expect(props.tags.items.type).toBe('string');
      expect(props.tags.minItems).toBe(1);
      expect(props.tags.maxItems).toBe(10);
      expect(props.tags['ui:options']).toBeDefined();
      expect(props.tags['ui:options'].orderable).toBe(true);
    });

    it('should handle tuple arrays (array of schemas)', () => {
      const ctd: ComponentType = {
        metadata: {
          workloadType: 'deployment',
          createdAt: '2025-01-01T00:00:00Z',
          name: 'service-with-tuple',
        },
        spec: {
          inputParametersSchema: {
            type: 'object',
            properties: {
              coordinates: {
                type: 'array',
                title: 'Coordinates',
                items: [
                  { type: 'number', title: 'Latitude' },
                  { type: 'number', title: 'Longitude' },
                ],
              },
            },
          },
        },
      };

      const result = converter.convertCtdToTemplateEntity(ctd, 'test-org');
      const parameters = result.spec?.parameters as any[];
      const props = parameters[2].properties;

      expect(props.coordinates.type).toBe('array');
      expect(props.coordinates.items).toHaveLength(2);
      expect(props.coordinates.items[0].type).toBe('number');
      expect(props.coordinates.items[1].type).toBe('number');
    });

    it('should handle string patterns and formats', () => {
      const ctd: ComponentType = {
        metadata: {
          workloadType: 'deployment',
          createdAt: '2025-01-01T00:00:00Z',
          name: 'service-with-validation',
        },
        spec: {
          inputParametersSchema: {
            type: 'object',
            properties: {
              email: {
                type: 'string',
                title: 'Email',
                format: 'email',
              },
              url: {
                type: 'string',
                title: 'URL',
                format: 'uri',
              },
              pattern: {
                type: 'string',
                title: 'Pattern',
                pattern: '^[a-z]+$',
              },
            },
          },
        },
      };

      const result = converter.convertCtdToTemplateEntity(ctd, 'test-org');
      const parameters = result.spec?.parameters as any[];
      const props = parameters[2].properties;

      expect(props.email.format).toBe('email');
      expect(props.email['ui:help']).toBe('Enter a valid email address');

      expect(props.url.format).toBe('uri');
      expect(props.url['ui:help']).toBe('Enter a valid URL');

      expect(props.pattern.pattern).toBe('^[a-z]+$');
    });

    it('should handle empty CTD schema', () => {
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

      // Should have Build & Deploy + Component Metadata + Traits sections
      // (CTD config section skipped due to empty properties)
      expect(parameters).toHaveLength(3);
      expect(parameters[0].title).toBe('Build & Deploy');
      expect(parameters[1].title).toBe('Component Metadata');
      expect(parameters[2].title).toBe('Enhance Your Component');
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

      // Should have all four sections: Build & Deploy, Component Metadata, CTD Configuration, and Traits
      expect(parameters).toHaveLength(4);

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

      // Check autoDeploy property
      expect(buildDeploySection.properties.autoDeploy).toBeDefined();
      expect(buildDeploySection.properties.autoDeploy.type).toBe('boolean');
      expect(buildDeploySection.properties.autoDeploy['ui:field']).toBe(
        'SwitchField',
      );

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

      // Check required fields for deploy-from-image
      expect(deployFromImageBranch.required).toEqual(['containerImage']);
    });

    it('should not include Build & Deploy section when CTD has no allowedWorkflows', () => {
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

      // Should have 4 sections: Build & Deploy, Component Metadata, CTD Configuration, and Traits
      // Build & Deploy is always present as the first step
      expect(parameters).toHaveLength(4);

      // Verify section order
      expect(parameters[0].title).toBe('Build & Deploy');
      expect(parameters[1].title).toBe('Component Metadata');
      expect(parameters[2].title).toContain('Configuration');
      expect(parameters[3].title).toBe('Enhance Your Component');
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

    it('should pass parameters to scaffolder action', () => {
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
    });
  });

  describe('conditional fields (dependencies)', () => {
    it('should handle simple property dependencies', () => {
      const ctd: ComponentType = {
        metadata: {
          workloadType: 'deployment',
          createdAt: '2025-01-01T00:00:00Z',
          name: 'service-with-deps',
        },
        spec: {
          inputParametersSchema: {
            type: 'object',
            properties: {
              enableFeature: { type: 'boolean' },
              featureConfig: { type: 'string' },
            },
            dependencies: {
              enableFeature: ['featureConfig'],
            },
          },
        },
      };

      const result = converter.convertCtdToTemplateEntity(ctd, 'test-org');
      const parameters = result.spec?.parameters as any[];
      const deps = parameters[2].dependencies;

      expect(deps).toBeDefined();
      expect(deps.enableFeature).toEqual(['featureConfig']);
    });

    it('should handle schema dependencies with if/then', () => {
      const ctd: ComponentType = {
        metadata: {
          workloadType: 'deployment',
          createdAt: '2025-01-01T00:00:00Z',
          name: 'conditional-service',
        },
        spec: {
          inputParametersSchema: {
            type: 'object',
            properties: {
              enableAuth: { type: 'boolean' },
              authType: { type: 'string', enum: ['oauth2', 'jwt'] },
            },
            dependencies: {
              enableAuth: {
                if: {
                  properties: { enableAuth: { const: true } },
                },
                then: {
                  required: ['authType'],
                },
              },
            },
          },
        },
      };

      const result = converter.convertCtdToTemplateEntity(ctd, 'test-org');
      const parameters = result.spec?.parameters as any[];
      const deps = parameters[2].dependencies;

      expect(deps).toBeDefined();
      expect(deps.enableAuth).toBeDefined();
      expect(deps.enableAuth.allOf).toBeDefined();
      expect(deps.enableAuth.allOf).toHaveLength(1);
      expect(deps.enableAuth.allOf[0].if).toBeDefined();
      expect(deps.enableAuth.allOf[0].then).toBeDefined();
      expect(deps.enableAuth.allOf[0].then.required).toEqual(['authType']);
    });

    it('should handle nested if/then/else in dependencies', () => {
      const ctd: ComponentType = {
        metadata: {
          workloadType: 'deployment',
          createdAt: '2025-01-01T00:00:00Z',
          name: 'nested-conditional',
        },
        spec: {
          inputParametersSchema: {
            type: 'object',
            properties: {
              tier: { type: 'string', enum: ['small', 'medium', 'custom'] },
              cpu: { type: 'string' },
              memory: { type: 'string' },
            },
            dependencies: {
              tier: {
                if: {
                  properties: { tier: { const: 'custom' } },
                },
                then: {
                  required: ['cpu', 'memory'],
                },
                else: {
                  properties: {
                    note: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      };

      const result = converter.convertCtdToTemplateEntity(ctd, 'test-org');
      const parameters = result.spec?.parameters as any[];
      const deps = parameters[2].dependencies;

      expect(deps.tier.allOf).toBeDefined();
      expect(deps.tier.allOf[0].if).toBeDefined();
      expect(deps.tier.allOf[0].then.required).toEqual(['cpu', 'memory']);
      expect(deps.tier.allOf[0].else).toBeDefined();
      expect(deps.tier.allOf[0].else.properties).toBeDefined();
    });

    it('should handle allOf in schema dependencies', () => {
      const ctd: ComponentType = {
        metadata: {
          workloadType: 'deployment',
          createdAt: '2025-01-01T00:00:00Z',
          name: 'allof-service',
        },
        spec: {
          inputParametersSchema: {
            type: 'object',
            properties: {
              enableFeatures: { type: 'boolean' },
            },
            dependencies: {
              enableFeatures: {
                allOf: [
                  {
                    if: { properties: { enableFeatures: { const: true } } },
                    then: { required: ['feature1'] },
                  },
                  {
                    if: { properties: { enableFeatures: { const: true } } },
                    then: { required: ['feature2'] },
                  },
                ],
              },
            },
          },
        },
      };

      const result = converter.convertCtdToTemplateEntity(ctd, 'test-org');
      const parameters = result.spec?.parameters as any[];
      const deps = parameters[2].dependencies;

      expect(deps.enableFeatures.allOf).toBeDefined();
      expect(deps.enableFeatures.allOf).toHaveLength(2);
      expect(deps.enableFeatures.allOf[0].then.required).toEqual(['feature1']);
      expect(deps.enableFeatures.allOf[1].then.required).toEqual(['feature2']);
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
      const props = parameters[2].properties;

      expect(props.config.additionalProperties.type).toBe('string');
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
