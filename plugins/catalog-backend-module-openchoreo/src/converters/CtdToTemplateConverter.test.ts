import { CtdToTemplateConverter, ComponentType } from './CtdToTemplateConverter';
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
      // Tags include 'openchoreo', the component name, and workloadType
      expect(result.metadata.tags).toEqual([
        'openchoreo',
        'simple-service',
        'deployment',
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
      expect(result.spec?.type).toBe('Component Type'); // All CTD templates use 'Component Type' type
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

      // First section should be Component Metadata
      expect(parameters[0].title).toBe('Component Metadata');
      expect(parameters[0].required).toEqual([
        'organization_name',
        'project_name',
        'component_name',
      ]);
      expect(parameters[0].properties.component_name).toBeDefined();
      expect(parameters[0].properties.organization_name).toBeDefined();
      expect(parameters[0].properties.project_name).toBeDefined();
      expect(parameters[0].properties.displayName).toBeDefined();
      expect(parameters[0].properties.description).toBeDefined();

      // Check UI fields
      expect(parameters[0].properties.component_name['ui:field']).toBe(
        'ComponentNamePicker',
      );
      expect(parameters[0].properties.organization_name['ui:disabled']).toBe(
        true,
      ); // Organization is fixed from CTD
      expect(parameters[0].properties.project_name['ui:field']).toBe(
        'EntityPicker',
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

      // Second section should be CTD configuration
      expect(parameters[1].title).toBe('Database Service Configuration');
      expect(parameters[1].required).toEqual(['databaseType', 'storageSize']);

      const props = parameters[1].properties;

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
      // Booleans now use default checkbox/switch widgets; no explicit radio widget
      expect(props.enableBackup['ui:widget']).toBeUndefined();
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
      const props = parameters[1].properties;

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
      const props = parameters[1].properties;

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
      const props = parameters[1].properties;

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
      const props = parameters[1].properties;

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

      // Should have Component Metadata + CI/CD Setup + Traits sections
      // (CTD config section skipped due to empty properties)
      expect(parameters).toHaveLength(3);
      expect(parameters[0].title).toBe('Component Metadata');
      expect(parameters[1].title).toBe('CI/CD Setup');
      expect(parameters[2].title).toBe('Traits');
    });

    it('should generate CI Setup section with workflow configuration when CTD has allowedWorkflows', () => {
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

      // Should have all four sections: Component Metadata, CTD Configuration, CI/CD Setup, and Traits
      expect(parameters).toHaveLength(4);

      // Check CI/CD Setup section (third section)
      const ciSetupSection = parameters[2];
      expect(ciSetupSection.title).toBe('CI/CD Setup');
      expect(ciSetupSection.required).toEqual(['autoDeploy', 'useBuiltInCI']);

      // Check useBuiltInCI property
      expect(ciSetupSection.properties.useBuiltInCI).toBeDefined();
      expect(ciSetupSection.properties.useBuiltInCI.type).toBe('boolean');
      expect(ciSetupSection.properties.useBuiltInCI.title).toBe(
        'Use Built-in CI in OpenChoreo',
      );
      // Uses SwitchField as ui:field for boolean switches
      expect(ciSetupSection.properties.useBuiltInCI['ui:field']).toBe(
        'SwitchField',
      );

      // Check dependencies structure uses oneOf with two branches
      expect(ciSetupSection.dependencies.useBuiltInCI).toBeDefined();
      expect(ciSetupSection.dependencies.useBuiltInCI.oneOf).toBeDefined();
      expect(ciSetupSection.dependencies.useBuiltInCI.oneOf).toHaveLength(2);

      // Check true case (when CI is enabled)
      const trueCase = ciSetupSection.dependencies.useBuiltInCI.oneOf[0];
      expect(trueCase.properties.useBuiltInCI.const).toBe(true);

      // Workflow fields present
      expect(trueCase.properties.workflow_name).toBeDefined();
      expect(trueCase.properties.workflow_parameters).toBeDefined();

      // Check workflow_name has enum from allowedWorkflows
      expect(trueCase.properties.workflow_name.enum).toEqual([
        'nodejs-build',
        'docker-build',
      ]);
      expect(trueCase.properties.workflow_name['ui:field']).toBe(
        'BuildWorkflowPicker',
      );

      // Check workflow_parameters uses custom UI field
      expect(trueCase.properties.workflow_parameters['ui:field']).toBe(
        'BuildWorkflowParameters',
      );

      // Check required fields when CI is enabled - only workflow fields now
      expect(trueCase.required).toEqual([
        'workflow_name',
        'workflow_parameters',
      ]);

      // Check false case (when CI is disabled)
      const falseCase = ciSetupSection.dependencies.useBuiltInCI.oneOf[1];
      expect(falseCase.properties.useBuiltInCI.const).toBe(false);
    });

    it('should not include CI Setup section when CTD has no allowedWorkflows', () => {
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

      // Should have 4 sections: Component Metadata, CTD Configuration, CI/CD Setup, and Traits
      expect(parameters).toHaveLength(4);

      // Verify section titles
      expect(parameters[0].title).toBe('Component Metadata');
      expect(parameters[1].title).toContain('Configuration');
      expect(parameters[2].title).toBe('CI/CD Setup');
      expect(parameters[3].title).toBe('Traits');

      // CI/CD Setup should be present but workflow_name should not have an enum when no allowedWorkflows
      const ciSetup = parameters.find(p => p.title === 'CI/CD Setup');
      expect(ciSetup).toBeDefined();
      expect(ciSetup!.dependencies.useBuiltInCI.oneOf[0].properties.workflow_name.enum).toBeUndefined();
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

      expect(input.orgName).toBe('${{ parameters.organization_name }}');
      expect(input.projectName).toBe('${{ parameters.project_name }}');
      expect(input.componentName).toBe('${{ parameters.component_name }}');
      expect(input.displayName).toBe('${{ parameters.displayName }}');
      expect(input.description).toBe('${{ parameters.description }}');
      expect(input.componentType).toBe('web-service');
      // CTD parameters are spread individually into the input (e.g. port)
      expect(input.port).toBe('${{ parameters.port }}');
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
      const deps = parameters[1].dependencies;

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
      const deps = parameters[1].dependencies;

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
      const deps = parameters[1].dependencies;

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
      const deps = parameters[1].dependencies;

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
      const props = parameters[1].properties;

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
