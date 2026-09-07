import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';

export const ResourceNamePickerFieldExtension = FormFieldBlueprint.make({
  name: 'resource-name-picker',
  params: {
    field: () =>
      import('./ResourceNamePickerExtension').then(m =>
        createFormField({
          name: 'ResourceNamePicker',
          component: m.ResourceNamePicker,
          validation: m.resourceNamePickerValidation,
        }),
      ),
  },
});
