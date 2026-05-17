import {
  RtdToTemplateConverter,
  ResourceTypeCRD,
} from './RtdToTemplateConverter';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

describe('RtdToTemplateConverter', () => {
  let converter: RtdToTemplateConverter;

  beforeEach(() => {
    converter = new RtdToTemplateConverter({
      defaultOwner: 'test-owner',
    });
  });

  describe('convertRtdToTemplateEntity', () => {
    it('converts a basic ResourceType to a scaffolder Template entity', () => {
      const rt: ResourceTypeCRD = {
        metadata: {
          name: 'postgres',
          displayName: 'PostgreSQL',
          description: 'Managed PostgreSQL database',
          createdAt: '2026-05-15T10:00:00Z',
        },
        spec: {
          retainPolicy: 'Delete',
          parameters: {
            openAPIV3Schema: {
              type: 'object',
              properties: {
                database: {
                  type: 'string',
                  title: 'Database name',
                  default: 'appdb',
                },
              },
              required: ['database'],
            },
          },
        },
      };

      const result = converter.convertRtdToTemplateEntity(rt, 'finance');

      expect(result.apiVersion).toBe('scaffolder.backstage.io/v1beta3');
      expect(result.kind).toBe('Template');
      expect(result.metadata.name).toBe('template-resource-postgres');
      expect(result.metadata.namespace).toBe('finance');
      expect(result.metadata.title).toBe('PostgreSQL');
      expect(result.metadata.description).toBe('Managed PostgreSQL database');

      expect(result.metadata.annotations?.[CHOREO_ANNOTATIONS.RTD_NAME]).toBe(
        'postgres',
      );
      expect(
        result.metadata.annotations?.[CHOREO_ANNOTATIONS.RTD_GENERATED],
      ).toBe('true');
      expect(result.metadata.annotations?.[CHOREO_ANNOTATIONS.RTD_KIND]).toBe(
        'ResourceType',
      );
      expect(
        result.metadata.annotations?.[CHOREO_ANNOTATIONS.RTD_DISPLAY_NAME],
      ).toBe('PostgreSQL');

      expect(result.spec?.owner).toBe('test-owner');
      expect(result.spec?.type).toBe('Resource');
      expect((result.spec as any)?.EXPERIMENTAL_formDecorators).toEqual([
        { id: 'openchoreo:inject-user-token' },
      ]);
    });

    it('falls back to a formatted title when displayName is not provided', () => {
      const rt: ResourceTypeCRD = {
        metadata: { name: 'message-queue' },
        spec: {},
      };

      const result = converter.convertRtdToTemplateEntity(rt, 'finance');

      expect(result.metadata.title).toBe('Message Queue');
      expect(result.metadata.description).toBe(
        'Create a Message Queue resource',
      );
      expect(
        result.metadata.annotations?.[CHOREO_ANNOTATIONS.RTD_DISPLAY_NAME],
      ).toBeUndefined();
    });

    it('uses the provided description verbatim when present', () => {
      const rt: ResourceTypeCRD = {
        metadata: {
          name: 'cache',
          description: 'A managed cache for fast reads.',
        },
        spec: {},
      };

      const result = converter.convertRtdToTemplateEntity(rt, 'finance');

      expect(result.metadata.description).toBe(
        'A managed cache for fast reads.',
      );
    });

    it('uses the default owner "guests" when no config is passed', () => {
      const defaultConverter = new RtdToTemplateConverter();
      const rt: ResourceTypeCRD = {
        metadata: { name: 'cache' },
        spec: {},
      };

      const result = defaultConverter.convertRtdToTemplateEntity(rt, 'finance');

      expect(result.spec?.owner).toBe('guests');
    });

    it('emits a Resource Metadata section with project_namespace + resource_name', () => {
      const rt: ResourceTypeCRD = {
        metadata: { name: 'postgres' },
        spec: {},
      };

      const result = converter.convertRtdToTemplateEntity(rt, 'finance');
      const params = (result.spec as any).parameters;
      const metadataSection = params[0];

      expect(metadataSection.title).toBe('Resource Metadata');
      expect(metadataSection.required).toEqual([
        'project_namespace',
        'resource_name',
      ]);
      expect(metadataSection.properties.project_namespace['ui:field']).toBe(
        'ProjectNamespaceField',
      );
      expect(
        metadataSection.properties.project_namespace['ui:options']
          .defaultNamespace,
      ).toBe('finance');
      expect(metadataSection.properties.resource_name['ui:field']).toBe(
        'ResourceNamePicker',
      );
    });

    it('emits a <Display Name> Details section with a ResourceParametersField pointing at the schema', () => {
      const rt: ResourceTypeCRD = {
        metadata: { name: 'postgres', displayName: 'PostgreSQL' },
        spec: {
          parameters: {
            openAPIV3Schema: {
              type: 'object',
              properties: {
                database: { type: 'string', title: 'Database name' },
              },
            },
          },
        },
      };

      const result = converter.convertRtdToTemplateEntity(rt, 'finance');
      const params = (result.spec as any).parameters;
      const detailsSection = params[1];

      expect(detailsSection.title).toBe('PostgreSQL Details');
      expect(detailsSection.properties.parameters['ui:field']).toBe(
        'ResourceParametersField',
      );
      const uiOptions = detailsSection.properties.parameters['ui:options'];
      expect(uiOptions.rtdName).toBe('postgres');
      expect(uiOptions.rtdKind).toBe('ResourceType');
      expect(uiOptions.rtdDisplayName).toBe('PostgreSQL');
      expect(uiOptions.rtdSchema).toEqual({
        type: 'object',
        properties: {
          database: { type: 'string', title: 'Database name' },
        },
      });
    });

    it('falls back to formatted title in the Details section when displayName is missing', () => {
      const rt: ResourceTypeCRD = {
        metadata: { name: 'message-queue' },
        spec: {},
      };

      const result = converter.convertRtdToTemplateEntity(rt, 'finance');
      const params = (result.spec as any).parameters;

      expect(params[1].title).toBe('Message Queue Details');
      expect(params[1].properties.parameters['ui:options'].rtdDisplayName).toBe(
        'Message Queue',
      );
    });

    it('omits rtdSchema in ui:options when the ResourceType has no schema', () => {
      const rt: ResourceTypeCRD = {
        metadata: { name: 'simple' },
        spec: {},
      };

      const result = converter.convertRtdToTemplateEntity(rt, 'finance');
      const params = (result.spec as any).parameters;
      const uiOptions = params[1].properties.parameters['ui:options'];

      expect(uiOptions.rtdSchema).toBeUndefined();
    });

    it('wires steps[0] to openchoreo:resource:create with structured input', () => {
      const rt: ResourceTypeCRD = {
        metadata: { name: 'postgres' },
        spec: {},
      };

      const result = converter.convertRtdToTemplateEntity(rt, 'finance');
      const steps = (result.spec as any).steps;

      expect(steps).toHaveLength(1);
      expect(steps[0].id).toBe('create-resource');
      expect(steps[0].action).toBe('openchoreo:resource:create');
      expect(steps[0].input).toEqual({
        namespaceName: '${{ parameters.project_namespace.namespace_name }}',
        projectName: '${{ parameters.project_namespace.project_name }}',
        resourceName: '${{ parameters.resource_name }}',
        displayName: '${{ parameters.displayName }}',
        description: '${{ parameters.description }}',
        typeKind: 'ResourceType',
        typeName: 'postgres',
        parameters: '${{ parameters.parameters }}',
      });
    });

    it('emits a View Resource output link pointing at the created entity', () => {
      const rt: ResourceTypeCRD = {
        metadata: { name: 'postgres' },
        spec: {},
      };

      const result = converter.convertRtdToTemplateEntity(rt, 'finance');
      const output = (result.spec as any).output;

      expect(output.links).toEqual([
        {
          title: 'View Resource',
          icon: 'kind:resource',
          entityRef:
            "resource:${{ steps['create-resource'].output.namespaceName }}/${{ steps['create-resource'].output.resourceName }}",
        },
      ]);
    });

    it('formats hyphenated and underscored ResourceType names as title case', () => {
      expect(
        converter.convertRtdToTemplateEntity(
          { metadata: { name: 'object-storage' }, spec: {} },
          'finance',
        ).metadata.title,
      ).toBe('Object Storage');
    });
  });
});
