import { Entity } from '@backstage/catalog-model';
import { OpenChoreoAPI } from '@openchoreo/openchoreo-client-node';
import { JSONSchema7, JSONSchema7Definition } from 'json-schema';
import {
  CHOREO_ANNOTATIONS,
  sanitizeLabel,
} from '@openchoreo/backstage-plugin-common';

type ComponentType = OpenChoreoAPI.ComponentType;

/**
 * Configuration for the Component Type to Template converter
 */
export interface CtdConverterConfig {
  /**
   * Default owner for generated templates
   */
  defaultOwner?: string;
  /**
   * Namespace for template entity names
   */
  namespace?: string;
}

/**
 * Converts OpenChoreo Component Types to Backstage Template entities
 */
export class CtdToTemplateConverter {
  private readonly defaultOwner: string;
  private readonly namespace: string;

  constructor(config?: CtdConverterConfig) {
    this.defaultOwner = config?.defaultOwner || 'guests';
    this.namespace = config?.namespace || 'openchoreo';
  }

  /**
   * Convert a Component Type to a Backstage Template entity
   */
  convertCtdToTemplateEntity(
    componentType: ComponentType,
    organizationName: string,
  ): Entity {
    const templateName = this.generateTemplateName(componentType.metadata.name);
    const title =
      componentType.metadata.displayName ||
      this.formatTitle(componentType.metadata.name);
    const description =
      componentType.metadata.description || `Create a ${title} component`;

    // Infer tags from component type name and workloadType
    const inferredTags = this.inferTagsFromCtd(componentType);
    const tags = [
      'openchoreo',
      ...inferredTags,
      ...(componentType.metadata.tags || []),
    ].filter(tag => tag && tag.trim().length > 0); // Filter out empty/whitespace-only tags

    // Build the template entity
    const templateEntity: Entity = {
      apiVersion: 'scaffolder.backstage.io/v1beta3',
      kind: 'Template',
      metadata: {
        name: templateName,
        namespace: this.namespace,
        title,
        description,
        tags,
        annotations: {
          [CHOREO_ANNOTATIONS.CTD_NAME]: componentType.metadata.name,
          [CHOREO_ANNOTATIONS.CTD_GENERATED]: 'true',
        },
      },
      spec: {
        owner: this.defaultOwner,
        type: 'Component Type', // All component type templates use 'Component Type' type
        parameters: this.generateParameters(componentType, organizationName),
        steps: this.generateSteps(componentType),
        output: {
          links: [
            {
              title: 'View Component',
              icon: 'kind:component',
              entityRef:
                "component:default/${{ steps['create-component'].output.componentName }}",
            },
          ],
        },
      },
    };

    // Add displayName annotation if provided
    if (componentType.metadata.displayName) {
      templateEntity.metadata.annotations![
        CHOREO_ANNOTATIONS.CTD_DISPLAY_NAME
      ] = componentType.metadata.displayName;
    }

    return templateEntity;
  }

  /**
   * Generate template name from component type name
   * Example: "web-service" -> "template-openchoreo-web-service"
   */
  private generateTemplateName(componentTypeName: string): string {
    return `template-${this.namespace}-${componentTypeName}`;
  }

  /**
   * Format component type name to human-readable title
   * Example: "web-service" -> "Web Service"
   */
  private formatTitle(name: string): string {
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Infer tags from component type name and workloadType
   * Example: name="web-service", workloadType="deployment" -> ["web", "service", "deployment"]
   */
  private inferTagsFromCtd(componentType: ComponentType): string[] {
    const tags: string[] = [];

    // Add tags from component type name (split by hyphen)
    tags.push(componentType.metadata.name);

    // Add workloadType as tag if available
    if (componentType.metadata.workloadType) {
      const workloadType = componentType.metadata.workloadType.toLowerCase();
      if (!tags.includes(workloadType)) {
        tags.push(workloadType);
      }
    }

    return tags;
  }

  /**
   * Generate template parameters from component type schema
   * Includes standard fields + component type-specific fields
   */
  private generateParameters(
    componentType: ComponentType,
    organizationName: string,
  ): any[] {
    const parameters: any[] = [];

    // Section 1: Component Metadata (standard fields)
    parameters.push({
      title: 'Component Metadata',
      required: ['organization_name', 'project_name', 'component_name'],
      properties: {
        component_name: {
          title: 'Component Name',
          type: 'string',
          description: 'Unique name for your component',
          'ui:field': 'ComponentNamePicker',
        },
        displayName: {
          title: 'Display Name',
          type: 'string',
          description: 'Human-readable display name',
        },
        description: {
          title: 'Description',
          type: 'string',
          description: 'Brief description of what this component does',
        },
        organization_name: {
          title: 'Organization',
          type: 'string',
          description: 'Auto selected based on Component Type',
          default: organizationName,
          'ui:disabled': true,
        },
        project_name: {
          title: 'Project',
          type: 'string',
          description: 'Select the project',
          'ui:field': 'EntityPicker',
          'ui:options': {
            catalogFilter: [{ kind: 'System' }],
          },
        },
      },
    });

    // Section 2: Component type-specific configuration
    const componentTypeSchema = componentType.spec.inputParametersSchema;
    if (
      componentTypeSchema &&
      componentTypeSchema.properties &&
      Object.keys(componentTypeSchema.properties).length > 0
    ) {
      const title =
        componentType.metadata.displayName ||
        this.formatTitle(componentType.metadata.name);

      parameters.push({
        title: `${title} Configuration`,
        required: componentTypeSchema.required || [],
        properties: this.convertJsonSchemaProperties(componentTypeSchema),
        dependencies: this.convertDependencies(componentTypeSchema),
      });
    }

    // Section 3: CI Setup (always shown - workflows fetched dynamically if not in allowedWorkflows)
    parameters.push(
      this.generateCISetupSection(componentType, organizationName),
    );

    // Section 4: Traits
    parameters.push(this.generateTraitsSection(organizationName));

    return parameters;
  }

  /**
   * Generate CI Setup section with workflow configuration
   * Always shows CI Setup section. If allowedWorkflows is provided, uses them for the dropdown.
   * Otherwise, BuildWorkflowPicker will fetch all workflows from the API.
   */
  private generateCISetupSection(
    componentType: ComponentType,
    organizationName: string,
  ): any {
    const hasAllowedWorkflows =
      componentType.metadata.allowedWorkflows &&
      componentType.metadata.allowedWorkflows.length > 0;

    // Build workflow_name field properties
    const workflowNameField: any = {
      title: 'Build Workflow',
      type: 'string',
      description: 'Select the build workflow to use for this component',
      'ui:field': 'BuildWorkflowPicker',
      'ui:options': {
        organizationName: organizationName,
      },
    };

    // Only add enum if allowedWorkflows is available
    if (hasAllowedWorkflows) {
      workflowNameField.enum = componentType.metadata.allowedWorkflows;
    }

    // Always show CI Setup section
    return {
      title: 'CI Setup',
      required: ['useBuiltInCI'],
      properties: {
        useBuiltInCI: {
          title: 'Use Built-in CI in OpenChoreo',
          description:
            'OpenChoreo provides built-in CI capabilities for building components. Enable this to use the built-in CI.',
          type: 'boolean',
          default: true,
          'ui:field': 'SwitchField',
        },
      },
      dependencies: {
        useBuiltInCI: {
          oneOf: [
            {
              properties: {
                useBuiltInCI: {
                  const: true,
                },
                workflow_name: workflowNameField,
                workflow_parameters: {
                  title: 'Workflow Parameters',
                  type: 'object',
                  'ui:field': 'BuildWorkflowParameters',
                },
              },
              required: ['workflow_name', 'workflow_parameters'],
            },
            {
              properties: {
                useBuiltInCI: {
                  const: false,
                },
              },
            },
          ],
        },
      },
    };
  }

  /**
   * Generate Traits section
   * Allows users to add multiple traits to the component
   */
  private generateTraitsSection(organizationName: string): any {
    return {
      title: 'Traits',
      description:
        'Add optional traits to enhance your component functionality',
      properties: {
        traits: {
          title: 'Component Traits',
          type: 'array',
          description:
            'Select and configure traits for your component. You can add multiple traits.',
          'ui:field': 'TraitsField',
          'ui:options': {
            organizationName: organizationName,
          },
          items: {
            type: 'object',
          },
        },
      },
    };
  }

  /**
   * Convert JSONSchema properties to Backstage RJSF format
   */
  private convertJsonSchemaProperties(schema: JSONSchema7): any {
    if (!schema.properties) {
      return {};
    }

    const convertedProperties: any = {};

    for (const [key, propDef] of Object.entries(schema.properties)) {
      if (typeof propDef === 'boolean') {
        // Skip boolean schema definitions
        continue;
      }

      const prop = propDef as JSONSchema7;
      convertedProperties[key] = this.convertJsonSchemaProperty(key, prop);
    }

    return convertedProperties;
  }

  /**
   * Convert a single JSONSchema property to Backstage RJSF format
   */
  private convertJsonSchemaProperty(key: string, schema: JSONSchema7): any {
    const converted: any = {
      type: schema.type,
    };

    // Copy basic properties
    // If schema doesn't have a title, generate one from the key
    if (schema.title) {
      converted.title = schema.title;
    } else if (key) {
      converted.title = sanitizeLabel(key);
    }
    if (schema.description) converted.description = schema.description;
    if (schema.default !== undefined) converted.default = schema.default;

    // Handle enums
    if (schema.enum) {
      converted.enum = schema.enum;
    }

    // Handle type-specific properties
    if (schema.type === 'string') {
      if (schema.pattern) converted.pattern = schema.pattern;
      if (schema.minLength) converted.minLength = schema.minLength;
      if (schema.maxLength) converted.maxLength = schema.maxLength;
      if (schema.format) converted.format = schema.format;
    } else if (schema.type === 'number' || schema.type === 'integer') {
      if (schema.minimum !== undefined) converted.minimum = schema.minimum;
      if (schema.maximum !== undefined) converted.maximum = schema.maximum;
      if (schema.multipleOf !== undefined)
        converted.multipleOf = schema.multipleOf;
    } else if (schema.type === 'array') {
      if (schema.items) {
        // Handle both single schema and array of schemas (tuple validation)
        if (Array.isArray(schema.items)) {
          converted.items = schema.items.map(item =>
            this.convertJsonSchemaDefinition(item),
          );
        } else {
          converted.items = this.convertJsonSchemaDefinition(schema.items);
        }
      }
      if (schema.minItems !== undefined) converted.minItems = schema.minItems;
      if (schema.maxItems !== undefined) converted.maxItems = schema.maxItems;
      if (schema.uniqueItems !== undefined)
        converted.uniqueItems = schema.uniqueItems;
    } else if (schema.type === 'object') {
      if (schema.properties) {
        converted.properties = this.convertJsonSchemaProperties(schema);
      }
      if (schema.additionalProperties !== undefined) {
        if (typeof schema.additionalProperties === 'boolean') {
          converted.additionalProperties = schema.additionalProperties;
        } else {
          converted.additionalProperties = this.convertJsonSchemaDefinition(
            schema.additionalProperties,
          );
        }
      }
      if (schema.required) {
        converted.required = schema.required;
      }
    }

    // Add UI enhancements based on type and format
    this.addUIEnhancements(converted, schema);

    return converted;
  }

  /**
   * Convert JSONSchema definition (can be boolean or schema)
   */
  private convertJsonSchemaDefinition(def: JSONSchema7Definition): any {
    if (typeof def === 'boolean') {
      return def;
    }
    return this.convertJsonSchemaProperty('', def);
  }

  /**
   * Add UI enhancements based on schema type and format
   */
  private addUIEnhancements(converted: any, schema: JSONSchema7): void {
    // Boolean fields: use default checkbox widget
    // (Custom switch widgets can be applied via ui:field in specific cases)

    // String fields with format hints
    if (schema.type === 'string') {
      if (schema.format === 'email') {
        converted['ui:help'] = 'Enter a valid email address';
      } else if (schema.format === 'uri' || schema.format === 'hostname') {
        converted['ui:help'] = 'Enter a valid URL';
      } else if (schema.format === 'date') {
        converted['ui:widget'] = 'date';
      } else if (schema.format === 'date-time') {
        converted['ui:widget'] = 'datetime';
      }

      // Long text fields: use textarea
      if (schema.maxLength && schema.maxLength > 100) {
        converted['ui:widget'] = 'textarea';
      }
    }

    // Arrays: use appropriate widget
    if (schema.type === 'array') {
      converted['ui:options'] = {
        orderable: true,
        addable: true,
        removable: true,
      };
    }
  }

  /**
   * Convert JSONSchema dependencies to Backstage RJSF format
   * Supports both property dependencies (arrays) and schema dependencies (objects with if/then)
   */
  private convertDependencies(schema: JSONSchema7): any {
    if (!schema.dependencies) {
      return undefined;
    }

    const converted: any = {};

    for (const [key, dep] of Object.entries(schema.dependencies)) {
      if (Array.isArray(dep)) {
        // Simple property dependency: when key is present, these props are required
        converted[key] = dep;
      } else if (typeof dep !== 'boolean') {
        // Schema dependency: convert the schema
        const convertedSchema = this.convertSchemaObject(dep);

        // If the schema doesn't already have allOf at root, wrap it
        // This is required for proper conditional field show/hide behavior in Backstage/RJSF
        if (!convertedSchema.allOf) {
          converted[key] = {
            allOf: [convertedSchema],
          };
        } else {
          // Already has allOf, don't double-wrap
          converted[key] = convertedSchema;
        }
      }
    }

    return Object.keys(converted).length > 0 ? converted : undefined;
  }

  /**
   * Convert a nested schema object (used for dependencies, if/then/else, etc.)
   * Recursively handles properties, required fields, and nested conditionals
   */
  private convertSchemaObject(schema: JSONSchema7): any {
    const converted: any = {};

    // Convert properties
    if (schema.properties) {
      converted.properties = this.convertJsonSchemaProperties(schema);
    }

    // Copy required array
    if (schema.required) {
      converted.required = schema.required;
    }

    // Handle if/then/else conditionals
    if (schema.if) {
      converted.if = schema.if; // Keep if condition as-is (used for evaluation)
    }
    if (schema.then) {
      converted.then =
        typeof schema.then === 'boolean'
          ? schema.then
          : this.convertSchemaObject(schema.then);
    }
    if (schema.else) {
      converted.else =
        typeof schema.else === 'boolean'
          ? schema.else
          : this.convertSchemaObject(schema.else);
    }

    // Handle allOf (combine multiple schemas)
    if (schema.allOf) {
      converted.allOf = schema.allOf.map(s =>
        typeof s === 'boolean' ? s : this.convertSchemaObject(s),
      );
    }

    return converted;
  }

  /**
   * Generate scaffolder steps for the template
   */
  private generateSteps(componentType: ComponentType): any[] {
    const ctdSchema = componentType.spec.inputParametersSchema;
    const ctdParameterMappings: Record<string, string> = {};

    // Generate mappings for each CTD parameter
    if (ctdSchema?.properties) {
      for (const paramName of Object.keys(ctdSchema.properties)) {
        ctdParameterMappings[paramName] = `\${{ parameters.${paramName} }}`;
      }
    }

    return [
      {
        id: 'create-component',
        name: 'Create OpenChoreo Component',
        action: 'openchoreo:component:create',
        input: {
          // Section 1: Component Metadata (use old field names for backward compatibility)
          orgName: '${{ parameters.organization_name }}',
          projectName: '${{ parameters.project_name }}',
          componentName: '${{ parameters.component_name }}',
          displayName: '${{ parameters.displayName }}',
          description: '${{ parameters.description }}',

          // Section 2: Component Type Configuration
          componentType: componentType.metadata.name,
          component_type_workload_type: componentType.metadata.workloadType,
          // Spread CTD parameters dynamically
          ...ctdParameterMappings,

          // Section 3: CI Setup
          useBuiltInCI: '${{ parameters.useBuiltInCI }}',
          repo_url: '${{ parameters.repo_url }}',
          branch: '${{ parameters.branch }}',
          component_path: '${{ parameters.component_path }}',
          workflow_name: '${{ parameters.workflow_name }}',
          workflow_parameters: '${{ parameters.workflow_parameters }}',

          // Section 4: Traits
          traits: '${{ parameters.traits }}',
        },
      },
    ];
  }
}
