import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';

export const DeploymentSourcePickerFieldExtension = FormFieldBlueprint.make({
  name: 'deployment-source-picker',
  params: {
    field: () =>
      import('./DeploymentSourcePicker').then(m =>
        createFormField({
          name: 'DeploymentSourcePicker',
          component: m.DeploymentSourcePicker,
          schema: m.DeploymentSourcePickerSchema as any,
        }),
      ),
  },
});
