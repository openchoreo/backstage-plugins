import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';

export const DeploymentPipelineFormWithYamlFieldExtension = FormFieldBlueprint.make({
  name: 'deployment-pipeline-form-with-yaml',
  params: {
    field: () =>
      import('./DeploymentPipelineFormWithYamlExtension').then(m =>
        createFormField({
          name: 'DeploymentPipelineFormWithYaml',
          component: m.DeploymentPipelineFormWithYamlExtension,
          schema: m.DeploymentPipelineFormWithYamlSchema as any,
          validation: m.deploymentPipelineFormWithYamlValidation,
        }),
      ),
  },
});
