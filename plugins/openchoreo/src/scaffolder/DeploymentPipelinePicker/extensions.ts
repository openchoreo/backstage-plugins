import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';

export const DeploymentPipelinePickerFieldExtension = FormFieldBlueprint.make({
  name: 'deployment-pipeline-picker',
  params: {
    field: () =>
      import('./DeploymentPipelinePickerExtension').then(m =>
        createFormField({
          name: 'DeploymentPipelinePicker',
          component: m.DeploymentPipelinePicker,
        }),
      ),
  },
});
