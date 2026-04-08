import {
  CtdToTemplateConverter,
  ComponentType,
} from './CtdToTemplateConverter';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

describe('CtdToTemplateConverter – convertClusterCtdToTemplateEntity', () => {
  let converter: CtdToTemplateConverter;

  beforeEach(() => {
    converter = new CtdToTemplateConverter({ defaultOwner: 'test-owner' });
  });

  const baseCtd: ComponentType = {
    metadata: {
      workloadType: 'deployment',
      createdAt: '2025-01-01T00:00:00Z',
      name: 'web-service',
      displayName: 'Web Service',
      description: 'A cluster-level web service',
    },
    spec: {
      inputParametersSchema: {
        type: 'object',
        properties: {
          port: { type: 'integer', title: 'Port', default: 8080 },
        },
        required: ['port'],
      },
    },
  };

  it('produces a Template entity with correct apiVersion and kind', () => {
    const result = converter.convertClusterCtdToTemplateEntity(baseCtd);

    expect(result.apiVersion).toBe('scaffolder.backstage.io/v1beta3');
    expect(result.kind).toBe('Template');
  });

  it('uses openchoreo-cluster namespace instead of a user namespace', () => {
    const result = converter.convertClusterCtdToTemplateEntity(baseCtd);

    expect(result.metadata.namespace).toBe('openchoreo-cluster');
  });

  it('sets CTD_KIND annotation to ClusterComponentType', () => {
    const result = converter.convertClusterCtdToTemplateEntity(baseCtd);

    expect(result.metadata.annotations?.[CHOREO_ANNOTATIONS.CTD_KIND]).toBe(
      'ClusterComponentType',
    );
  });

  it('sets standard CTD annotations (name, generated, workload type)', () => {
    const result = converter.convertClusterCtdToTemplateEntity(baseCtd);
    const annotations = result.metadata.annotations!;

    expect(annotations[CHOREO_ANNOTATIONS.CTD_NAME]).toBe('web-service');
    expect(annotations[CHOREO_ANNOTATIONS.CTD_GENERATED]).toBe('true');
    expect(annotations[CHOREO_ANNOTATIONS.WORKLOAD_TYPE]).toBe('deployment');
  });

  it('sets CTD_DISPLAY_NAME annotation when displayName is provided', () => {
    const result = converter.convertClusterCtdToTemplateEntity(baseCtd);

    expect(
      result.metadata.annotations?.[CHOREO_ANNOTATIONS.CTD_DISPLAY_NAME],
    ).toBe('Web Service');
  });

  it('does not set CTD_DISPLAY_NAME when displayName is absent', () => {
    const ctd: ComponentType = {
      ...baseCtd,
      metadata: { ...baseCtd.metadata, displayName: undefined },
    };
    const result = converter.convertClusterCtdToTemplateEntity(ctd);

    expect(
      result.metadata.annotations?.[CHOREO_ANNOTATIONS.CTD_DISPLAY_NAME],
    ).toBeUndefined();
  });

  it('uses displayName for title, falls back to formatted name', () => {
    const result = converter.convertClusterCtdToTemplateEntity(baseCtd);
    expect(result.metadata.title).toBe('Web Service');

    const noDisplayName: ComponentType = {
      ...baseCtd,
      metadata: {
        ...baseCtd.metadata,
        name: 'my-custom-svc',
        displayName: undefined,
      },
    };
    const fallback = converter.convertClusterCtdToTemplateEntity(noDisplayName);
    expect(fallback.metadata.title).toBe('My Custom Svc'); // formatted from "my-custom-svc"
  });

  it('generates default description when none provided', () => {
    const ctd: ComponentType = {
      ...baseCtd,
      metadata: { ...baseCtd.metadata, description: undefined },
    };
    const result = converter.convertClusterCtdToTemplateEntity(ctd);

    expect(result.metadata.description).toBe('Create a Web Service component');
  });

  it('generates 3 parameter sections', () => {
    const result = converter.convertClusterCtdToTemplateEntity(baseCtd);
    const parameters = result.spec?.parameters as any[];

    expect(parameters).toHaveLength(3);
    expect(parameters[0].title).toBe('Component Metadata');
    expect(parameters[1].title).toBe('Build & Deploy');
    expect(parameters[2].title).toBe('Web Service Details');
  });

  it('passes empty namespace to ProjectNamespaceField for namespace dropdown', () => {
    const result = converter.convertClusterCtdToTemplateEntity(baseCtd);
    const parameters = result.spec?.parameters as any[];
    const nsField = parameters[0].properties.project_namespace;

    expect(nsField['ui:options'].defaultNamespace).toBe('');
  });

  it('passes ClusterComponentType to scaffolder step input', () => {
    const result = converter.convertClusterCtdToTemplateEntity(baseCtd);
    const steps = result.spec?.steps as any[];

    expect(steps).toHaveLength(1);
    expect(steps[0].input.component_type_kind).toBe('ClusterComponentType');
  });

  it('uses ClusterWorkflow as default workflow kind for allowedWorkflows strings', () => {
    const ctd: ComponentType = {
      ...baseCtd,
      metadata: {
        ...baseCtd.metadata,
        allowedWorkflows: ['docker-build', 'buildpacks'],
      },
    };
    const result = converter.convertClusterCtdToTemplateEntity(ctd);
    const parameters = result.spec?.parameters as any[];
    const buildSection = parameters[1];
    const buildBranch = buildSection.dependencies.deploymentSource.oneOf[0];

    expect(
      buildBranch.properties.workflow_name['ui:options'].allowedWorkflows,
    ).toEqual([
      { kind: 'ClusterWorkflow', name: 'docker-build' },
      { kind: 'ClusterWorkflow', name: 'buildpacks' },
    ]);
  });

  it('preserves explicit kind in mixed allowedWorkflows', () => {
    const ctd: ComponentType = {
      ...baseCtd,
      metadata: {
        ...baseCtd.metadata,
        allowedWorkflows: [
          'default-build',
          { kind: 'Workflow', name: 'ns-build' },
        ] as any,
      },
    };
    const result = converter.convertClusterCtdToTemplateEntity(ctd);
    const parameters = result.spec?.parameters as any[];
    const buildBranch = parameters[1].dependencies.deploymentSource.oneOf[0];

    expect(
      buildBranch.properties.workflow_name['ui:options'].allowedWorkflows,
    ).toEqual([
      { kind: 'ClusterWorkflow', name: 'default-build' },
      { kind: 'Workflow', name: 'ns-build' },
    ]);
  });

  it('passes allowedTraits through to WorkloadDetailsField', () => {
    const ctd: ComponentType = {
      ...baseCtd,
      metadata: {
        ...baseCtd.metadata,
        allowedTraits: [
          { kind: 'ClusterTrait', name: 'ingress' },
          { kind: 'ClusterTrait', name: 'autoscaler' },
        ],
      },
    };
    const result = converter.convertClusterCtdToTemplateEntity(ctd);
    const parameters = result.spec?.parameters as any[];
    const options = parameters[2].properties.workloadDetails['ui:options'];

    expect(options.allowedTraits).toEqual([
      { kind: 'ClusterTrait', name: 'ingress' },
      { kind: 'ClusterTrait', name: 'autoscaler' },
    ]);
  });

  it('passes CTD schema in workloadDetails ui:options', () => {
    const result = converter.convertClusterCtdToTemplateEntity(baseCtd);
    const parameters = result.spec?.parameters as any[];
    const options = parameters[2].properties.workloadDetails['ui:options'];

    expect(options.ctdSchema).toBeDefined();
    expect(options.ctdSchema.properties.port.type).toBe('integer');
    expect(options.ctdSchema.required).toEqual(['port']);
  });

  it('uses default owner when custom config provided', () => {
    const result = converter.convertClusterCtdToTemplateEntity(baseCtd);
    expect(result.spec?.owner).toBe('test-owner');
  });

  it('uses guests as owner when no config provided', () => {
    const defaultConverter = new CtdToTemplateConverter();
    const result = defaultConverter.convertClusterCtdToTemplateEntity(baseCtd);
    expect(result.spec?.owner).toBe('guests');
  });

  it('includes form decorator for user token injection', () => {
    const result = converter.convertClusterCtdToTemplateEntity(baseCtd);
    expect(result.spec?.EXPERIMENTAL_formDecorators).toEqual([
      { id: 'openchoreo:inject-user-token' },
    ]);
  });

  it('includes output link with entity ref template', () => {
    const result = converter.convertClusterCtdToTemplateEntity(baseCtd);
    const output = result.spec?.output as any;

    expect(output.links).toHaveLength(1);
    expect(output.links[0].entityRef).toContain(
      "steps['create-component'].output",
    );
  });
});
