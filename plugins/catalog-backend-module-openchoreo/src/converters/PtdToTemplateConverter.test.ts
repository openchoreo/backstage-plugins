import {
  PtdToTemplateConverter,
  ProjectTypeCRD,
} from './PtdToTemplateConverter';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

describe('PtdToTemplateConverter', () => {
  let converter: PtdToTemplateConverter;

  beforeEach(() => {
    converter = new PtdToTemplateConverter({ defaultOwner: 'test-owner' });
  });

  describe('convertPtdToTemplateEntity', () => {
    it('converts a basic ProjectType to a scaffolder Template entity', () => {
      const pt: ProjectTypeCRD = {
        metadata: {
          name: 'web-app',
          displayName: 'Web Application',
          description: 'A standard web application project',
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

      const result = converter.convertPtdToTemplateEntity(pt, 'finance');

      expect(result.apiVersion).toBe('scaffolder.backstage.io/v1beta3');
      expect(result.kind).toBe('Template');
      expect(result.metadata.name).toBe('template-project-web-app');
      expect(result.metadata.namespace).toBe('finance');
      expect(result.metadata.title).toBe('Web Application');
      expect(result.metadata.description).toBe(
        'A standard web application project',
      );

      expect(result.metadata.annotations?.[CHOREO_ANNOTATIONS.PTD_NAME]).toBe(
        'web-app',
      );
      expect(
        result.metadata.annotations?.[CHOREO_ANNOTATIONS.PTD_GENERATED],
      ).toBe('true');
      expect(result.metadata.annotations?.[CHOREO_ANNOTATIONS.PTD_KIND]).toBe(
        'ProjectType',
      );
      expect(
        result.metadata.annotations?.[CHOREO_ANNOTATIONS.PTD_DISPLAY_NAME],
      ).toBe('Web Application');

      expect(result.spec?.owner).toBe('test-owner');
      expect(result.spec?.type).toBe('Project');
      expect((result.spec as any)?.EXPERIMENTAL_formDecorators).toEqual([
        { id: 'openchoreo:inject-user-token' },
      ]);
    });

    it('falls back to a formatted title when displayName is not provided', () => {
      const pt: ProjectTypeCRD = {
        metadata: { name: 'data-pipeline' },
        spec: {},
      };

      const result = converter.convertPtdToTemplateEntity(pt, 'finance');

      expect(result.metadata.title).toBe('Data Pipeline');
      expect(result.metadata.description).toBe(
        'Create a Data Pipeline project',
      );
      expect(
        result.metadata.annotations?.[CHOREO_ANNOTATIONS.PTD_DISPLAY_NAME],
      ).toBeUndefined();
    });

    it('uses the provided description verbatim when present', () => {
      const pt: ProjectTypeCRD = {
        metadata: { name: 'svc', description: 'Backing services project.' },
        spec: {},
      };

      const result = converter.convertPtdToTemplateEntity(pt, 'finance');

      expect(result.metadata.description).toBe('Backing services project.');
    });

    it('uses the default owner "guests" when no config is passed', () => {
      const defaultConverter = new PtdToTemplateConverter();
      const result = defaultConverter.convertPtdToTemplateEntity(
        { metadata: { name: 'svc' }, spec: {} },
        'finance',
      );

      expect(result.spec?.owner).toBe('guests');
    });

    it('emits a Project Metadata section with namespace + project_name + deployment pipeline', () => {
      const pt: ProjectTypeCRD = {
        metadata: { name: 'web-app' },
        spec: {},
      };

      const result = converter.convertPtdToTemplateEntity(pt, 'finance');
      const params = (result.spec as any).parameters;
      const metadataSection = params[0];

      expect(metadataSection.title).toBe('Project Metadata');
      expect(metadataSection.required).toEqual([
        'namespace_name',
        'project_name',
        'deployment_pipeline',
      ]);
      expect(metadataSection.properties.namespace_name['ui:field']).toBe(
        'NamespaceEntityPicker',
      );
      expect(metadataSection.properties.project_name['ui:field']).toBe(
        'ResourceNamePicker',
      );
      expect(
        metadataSection.properties.project_name['ui:options'].catalogKind,
      ).toBe('System');
      expect(metadataSection.properties.deployment_pipeline['ui:field']).toBe(
        'DeploymentPipelinePicker',
      );
    });

    it('emits a default-on Auto Deploy toggle in the Project Metadata section', () => {
      const pt: ProjectTypeCRD = {
        metadata: { name: 'web-app' },
        spec: {},
      };

      const result = converter.convertPtdToTemplateEntity(pt, 'finance');
      const autoDeploy = (result.spec as any).parameters[0].properties
        .auto_deploy;

      expect(autoDeploy.type).toBe('boolean');
      expect(autoDeploy.title).toBe('Auto Deploy');
      expect(autoDeploy.default).toBe(true);
      expect(autoDeploy['ui:field']).toBe('SwitchField');
      // Opting out has consequences (manual deploy before any component
      // deploys); SwitchField surfaces this while the toggle is off.
      expect(autoDeploy['ui:options'].offWarning).toMatch(/deploy it manually/);
      // Not in the section's required list: a toggle always carries a value.
      expect((result.spec as any).parameters[0].required).not.toContain(
        'auto_deploy',
      );
    });

    it('pre-fills the namespace dropdown with the type own namespace (namespaced scope)', () => {
      const pt: ProjectTypeCRD = { metadata: { name: 'web-app' }, spec: {} };

      const result = converter.convertPtdToTemplateEntity(pt, 'finance');
      const nsField = (result.spec as any).parameters[0].properties
        .namespace_name;

      expect(nsField.default).toBe('domain:default/finance');
    });

    it('emits a <Display Name> Details section with a ProjectParametersField pointing at the schema', () => {
      const pt: ProjectTypeCRD = {
        metadata: { name: 'web-app', displayName: 'Web Application' },
        spec: {
          parameters: {
            openAPIV3Schema: {
              type: 'object',
              properties: { replicas: { type: 'integer', title: 'Replicas' } },
            },
          },
        },
      };

      const result = converter.convertPtdToTemplateEntity(pt, 'finance');
      const detailsSection = (result.spec as any).parameters[1];

      expect(detailsSection.title).toBe('Web Application Details');
      expect(detailsSection.properties.parameters['ui:field']).toBe(
        'ProjectParametersField',
      );
      const uiOptions = detailsSection.properties.parameters['ui:options'];
      expect(uiOptions.ptdName).toBe('web-app');
      expect(uiOptions.ptdKind).toBe('ProjectType');
      expect(uiOptions.ptdDisplayName).toBe('Web Application');
      expect(uiOptions.ptdSchema).toEqual({
        type: 'object',
        properties: { replicas: { type: 'integer', title: 'Replicas' } },
      });
    });

    it('omits ptdSchema in ui:options when the ProjectType has no schema', () => {
      const pt: ProjectTypeCRD = { metadata: { name: 'simple' }, spec: {} };

      const result = converter.convertPtdToTemplateEntity(pt, 'finance');
      const uiOptions = (result.spec as any).parameters[1].properties
        .parameters['ui:options'];

      expect(uiOptions.ptdSchema).toBeUndefined();
    });

    it('wires steps[0] to openchoreo:project:create with structured input', () => {
      const pt: ProjectTypeCRD = { metadata: { name: 'web-app' }, spec: {} };

      const result = converter.convertPtdToTemplateEntity(pt, 'finance');
      const steps = (result.spec as any).steps;

      expect(steps).toHaveLength(1);
      expect(steps[0].id).toBe('create-project');
      expect(steps[0].action).toBe('openchoreo:project:create');
      expect(steps[0].input).toEqual({
        namespaceName: '${{ parameters.namespace_name }}',
        projectName: '${{ parameters.project_name }}',
        displayName: '${{ parameters.displayName }}',
        description: '${{ parameters.description }}',
        deploymentPipeline: '${{ parameters.deployment_pipeline }}',
        autoDeploy: '${{ parameters.auto_deploy }}',
        typeKind: 'ProjectType',
        typeName: 'web-app',
        parameters: '${{ parameters.parameters }}',
      });
    });

    it('emits a View Project output link pointing at the created entity', () => {
      const pt: ProjectTypeCRD = { metadata: { name: 'web-app' }, spec: {} };

      const result = converter.convertPtdToTemplateEntity(pt, 'finance');
      const output = (result.spec as any).output;

      expect(output.links).toEqual([
        {
          title: 'View Project',
          icon: 'kind:system',
          entityRef:
            "system:${{ steps['create-project'].output.namespaceName }}/${{ steps['create-project'].output.projectName }}",
        },
      ]);
    });

    it('emits a conditional manual-deploy warning text output', () => {
      const pt: ProjectTypeCRD = { metadata: { name: 'web-app' }, spec: {} };

      const result = converter.convertPtdToTemplateEntity(pt, 'finance');
      const output = (result.spec as any).output;

      // A static, schema-valid array (output.text must be an array) whose single
      // entry is dropped by the scaffolder when the `if` condition is falsy.
      // `icon: 'warning'` selects the alert severity in the app's custom
      // outputs renderer; no title so the note renders as a plain warning bar.
      expect(output.text).toHaveLength(1);
      expect(output.text[0].if).toBe(
        "${{ steps['create-project'].output.autoDeployFailed }}",
      );
      expect(output.text[0].icon).toBe('warning');
      expect(output.text[0].title).toBeUndefined();
      expect(output.text[0].content).toContain(
        "${{ steps['create-project'].output.failedEnvironments }}",
      );
    });

    it('formats hyphenated ProjectType names as title case', () => {
      expect(
        converter.convertPtdToTemplateEntity(
          { metadata: { name: 'event-driven' }, spec: {} },
          'finance',
        ).metadata.title,
      ).toBe('Event Driven');
    });
  });
});
