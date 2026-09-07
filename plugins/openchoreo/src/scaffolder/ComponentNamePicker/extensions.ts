import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';

export const ComponentNamePickerFieldExtension = FormFieldBlueprint.make({
  name: 'component-name-picker',
  params: {
    field: () =>
      import('./ComponentNamePickerExtension').then(m =>
        createFormField({
          name: 'ComponentNamePicker',
          component: m.ComponentNamePicker,
          validation: m.componentNamePickerValidation,
        }),
      ),
  },
});
