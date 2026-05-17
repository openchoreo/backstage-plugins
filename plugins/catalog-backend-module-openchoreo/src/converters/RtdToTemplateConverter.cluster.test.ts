import {
  RtdToTemplateConverter,
  ResourceTypeCRD,
} from './RtdToTemplateConverter';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

describe('RtdToTemplateConverter – convertClusterRtdToTemplateEntity', () => {
  let converter: RtdToTemplateConverter;

  beforeEach(() => {
    converter = new RtdToTemplateConverter({ defaultOwner: 'test-owner' });
  });

  const baseCrt: ResourceTypeCRD = {
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

  it('produces a Template entity with correct apiVersion and kind', () => {
    const result = converter.convertClusterRtdToTemplateEntity(baseCrt);

    expect(result.apiVersion).toBe('scaffolder.backstage.io/v1beta3');
    expect(result.kind).toBe('Template');
  });

  it('uses openchoreo-cluster namespace instead of a user namespace', () => {
    const result = converter.convertClusterRtdToTemplateEntity(baseCrt);

    expect(result.metadata.namespace).toBe('openchoreo-cluster');
  });

  it('sets RTD_KIND annotation to ClusterResourceType', () => {
    const result = converter.convertClusterRtdToTemplateEntity(baseCrt);

    expect(result.metadata.annotations?.[CHOREO_ANNOTATIONS.RTD_KIND]).toBe(
      'ClusterResourceType',
    );
  });

  it('sets standard RTD annotations (name, generated)', () => {
    const result = converter.convertClusterRtdToTemplateEntity(baseCrt);
    const annotations = result.metadata.annotations!;

    expect(annotations[CHOREO_ANNOTATIONS.RTD_NAME]).toBe('postgres');
    expect(annotations[CHOREO_ANNOTATIONS.RTD_GENERATED]).toBe('true');
  });

  it('sets RTD_DISPLAY_NAME annotation when displayName is provided', () => {
    const result = converter.convertClusterRtdToTemplateEntity(baseCrt);

    expect(
      result.metadata.annotations?.[CHOREO_ANNOTATIONS.RTD_DISPLAY_NAME],
    ).toBe('PostgreSQL');
  });

  it('does not set RTD_DISPLAY_NAME when displayName is absent', () => {
    const crt: ResourceTypeCRD = {
      ...baseCrt,
      metadata: { ...baseCrt.metadata, displayName: undefined },
    };
    const result = converter.convertClusterRtdToTemplateEntity(crt);

    expect(
      result.metadata.annotations?.[CHOREO_ANNOTATIONS.RTD_DISPLAY_NAME],
    ).toBeUndefined();
  });

  it('uses displayName for title, falls back to formatted name', () => {
    const result = converter.convertClusterRtdToTemplateEntity(baseCrt);
    expect(result.metadata.title).toBe('PostgreSQL');

    const noDisplayName: ResourceTypeCRD = {
      ...baseCrt,
      metadata: { name: 'message-queue' },
    };
    const fallback = converter.convertClusterRtdToTemplateEntity(noDisplayName);
    expect(fallback.metadata.title).toBe('Message Queue');
  });

  it('generates default description when none provided', () => {
    const crt: ResourceTypeCRD = {
      ...baseCrt,
      metadata: { ...baseCrt.metadata, description: undefined },
    };
    const result = converter.convertClusterRtdToTemplateEntity(crt);

    expect(result.metadata.description).toBe('Create a PostgreSQL resource');
  });

  it('generates 2 parameter sections (Resource Metadata + <Type> Details)', () => {
    const result = converter.convertClusterRtdToTemplateEntity(baseCrt);
    const parameters = (result.spec as any).parameters as any[];

    expect(parameters).toHaveLength(2);
    expect(parameters[0].title).toBe('Resource Metadata');
    expect(parameters[1].title).toBe('PostgreSQL Details');
  });

  it('passes empty namespace to ProjectNamespaceField (no implicit pre-fill on cluster scope)', () => {
    const result = converter.convertClusterRtdToTemplateEntity(baseCrt);
    const parameters = (result.spec as any).parameters as any[];
    const nsField = parameters[0].properties.project_namespace;

    expect(nsField['ui:options'].defaultNamespace).toBe('');
  });

  it('passes ClusterResourceType to scaffolder step input typeKind', () => {
    const result = converter.convertClusterRtdToTemplateEntity(baseCrt);
    const steps = (result.spec as any).steps as any[];

    expect(steps).toHaveLength(1);
    expect(steps[0].input.typeKind).toBe('ClusterResourceType');
    expect(steps[0].input.typeName).toBe('postgres');
  });

  it('passes RTD schema in parameters ui:options', () => {
    const result = converter.convertClusterRtdToTemplateEntity(baseCrt);
    const parameters = (result.spec as any).parameters as any[];
    const options = parameters[1].properties.parameters['ui:options'];

    expect(options.rtdSchema).toBeDefined();
    expect(options.rtdSchema.properties.database.type).toBe('string');
    expect(options.rtdSchema.required).toEqual(['database']);
    expect(options.rtdKind).toBe('ClusterResourceType');
  });

  it('uses default owner when custom config provided', () => {
    const result = converter.convertClusterRtdToTemplateEntity(baseCrt);
    expect(result.spec?.owner).toBe('test-owner');
  });

  it('uses guests as owner when no config provided', () => {
    const defaultConverter = new RtdToTemplateConverter();
    const result = defaultConverter.convertClusterRtdToTemplateEntity(baseCrt);
    expect(result.spec?.owner).toBe('guests');
  });

  it('includes form decorator for user token injection', () => {
    const result = converter.convertClusterRtdToTemplateEntity(baseCrt);
    expect((result.spec as any).EXPERIMENTAL_formDecorators).toEqual([
      { id: 'openchoreo:inject-user-token' },
    ]);
  });

  it('includes output link with entity ref template', () => {
    const result = converter.convertClusterRtdToTemplateEntity(baseCrt);
    const output = (result.spec as any).output;

    expect(output.links).toHaveLength(1);
    expect(output.links[0].entityRef).toContain(
      "steps['create-resource'].output",
    );
  });
});
