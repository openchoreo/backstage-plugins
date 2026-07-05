import {
  PtdToTemplateConverter,
  ProjectTypeCRD,
} from './PtdToTemplateConverter';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

describe('PtdToTemplateConverter – convertClusterPtdToTemplateEntity', () => {
  let converter: PtdToTemplateConverter;

  beforeEach(() => {
    converter = new PtdToTemplateConverter({ defaultOwner: 'test-owner' });
  });

  const baseCpt: ProjectTypeCRD = {
    metadata: {
      name: 'default',
      displayName: 'Default Project',
      description: 'The default cluster project type',
      createdAt: '2026-06-01T10:00:00Z',
    },
    spec: {
      parameters: {
        openAPIV3Schema: {
          type: 'object',
          properties: {
            replicas: { type: 'integer', title: 'Replicas', default: 1 },
          },
          required: ['replicas'],
        },
      },
    },
  };

  it('produces a Template entity with correct apiVersion and kind', () => {
    const result = converter.convertClusterPtdToTemplateEntity(baseCpt);

    expect(result.apiVersion).toBe('scaffolder.backstage.io/v1beta3');
    expect(result.kind).toBe('Template');
  });

  it('uses openchoreo-cluster namespace instead of a user namespace', () => {
    const result = converter.convertClusterPtdToTemplateEntity(baseCpt);

    expect(result.metadata.namespace).toBe('openchoreo-cluster');
  });

  it('sets PTD_KIND annotation to ClusterProjectType', () => {
    const result = converter.convertClusterPtdToTemplateEntity(baseCpt);

    expect(result.metadata.annotations?.[CHOREO_ANNOTATIONS.PTD_KIND]).toBe(
      'ClusterProjectType',
    );
  });

  it('sets standard PTD annotations (name, generated)', () => {
    const result = converter.convertClusterPtdToTemplateEntity(baseCpt);
    const annotations = result.metadata.annotations!;

    expect(annotations[CHOREO_ANNOTATIONS.PTD_NAME]).toBe('default');
    expect(annotations[CHOREO_ANNOTATIONS.PTD_GENERATED]).toBe('true');
  });

  it('names the template template-project-<name>', () => {
    const result = converter.convertClusterPtdToTemplateEntity(baseCpt);

    expect(result.metadata.name).toBe('template-project-default');
  });

  it('does not set PTD_DISPLAY_NAME when displayName is absent', () => {
    const cpt: ProjectTypeCRD = {
      ...baseCpt,
      metadata: { ...baseCpt.metadata, displayName: undefined },
    };
    const result = converter.convertClusterPtdToTemplateEntity(cpt);

    expect(
      result.metadata.annotations?.[CHOREO_ANNOTATIONS.PTD_DISPLAY_NAME],
    ).toBeUndefined();
  });

  it('does not pre-fill the namespace dropdown on cluster scope', () => {
    const result = converter.convertClusterPtdToTemplateEntity(baseCpt);
    const nsField = (result.spec as any).parameters[0].properties
      .namespace_name;

    expect(nsField.default).toBeUndefined();
  });

  it('generates 2 parameter sections (Project Metadata + <Type> Details)', () => {
    const result = converter.convertClusterPtdToTemplateEntity(baseCpt);
    const parameters = (result.spec as any).parameters as any[];

    expect(parameters).toHaveLength(2);
    expect(parameters[0].title).toBe('Project Metadata');
    expect(parameters[1].title).toBe('Default Project Details');
  });

  it('passes ClusterProjectType to scaffolder step input typeKind', () => {
    const result = converter.convertClusterPtdToTemplateEntity(baseCpt);
    const steps = (result.spec as any).steps as any[];

    expect(steps).toHaveLength(1);
    expect(steps[0].input.typeKind).toBe('ClusterProjectType');
    expect(steps[0].input.typeName).toBe('default');
  });

  it('emits a default-on Auto Deploy toggle and threads it into the step input', () => {
    const result = converter.convertClusterPtdToTemplateEntity(baseCpt);
    const autoDeploy = (result.spec as any).parameters[0].properties
      .auto_deploy;
    const steps = (result.spec as any).steps as any[];

    expect(autoDeploy.type).toBe('boolean');
    expect(autoDeploy.default).toBe(true);
    expect(autoDeploy['ui:field']).toBe('SwitchField');
    expect(steps[0].input.autoDeploy).toBe('${{ parameters.auto_deploy }}');
  });

  it('passes PTD schema in parameters ui:options', () => {
    const result = converter.convertClusterPtdToTemplateEntity(baseCpt);
    const options = (result.spec as any).parameters[1].properties.parameters[
      'ui:options'
    ];

    expect(options.ptdSchema).toBeDefined();
    expect(options.ptdSchema.properties.replicas.type).toBe('integer');
    expect(options.ptdSchema.required).toEqual(['replicas']);
    expect(options.ptdKind).toBe('ClusterProjectType');
  });

  it('uses guests as owner when no config provided', () => {
    const defaultConverter = new PtdToTemplateConverter();
    const result = defaultConverter.convertClusterPtdToTemplateEntity(baseCpt);
    expect(result.spec?.owner).toBe('guests');
  });

  it('includes form decorator for user token injection', () => {
    const result = converter.convertClusterPtdToTemplateEntity(baseCpt);
    expect((result.spec as any).EXPERIMENTAL_formDecorators).toEqual([
      { id: 'openchoreo:inject-user-token' },
    ]);
  });

  it('includes output link with entity ref template', () => {
    const result = converter.convertClusterPtdToTemplateEntity(baseCpt);
    const output = (result.spec as any).output;

    expect(output.links).toHaveLength(1);
    expect(output.links[0].entityRef).toContain(
      "steps['create-project'].output",
    );
  });
});
