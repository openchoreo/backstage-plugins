import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';

export const BuildWorkflowPickerFieldExtension = FormFieldBlueprint.make({
  name: 'build-workflow-picker',
  params: {
    field: () =>
      import('./BuildWorkflowPickerExtension').then(m =>
        createFormField({
          name: 'BuildWorkflowPicker',
          component: m.BuildWorkflowPicker,
          schema: m.BuildWorkflowPickerSchema as any,
          validation: m.buildWorkflowPickerValidation,
        }),
      ),
  },
});
