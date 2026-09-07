import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';

export const BuildTemplatePickerFieldExtension = FormFieldBlueprint.make({
  name: 'build-template-picker',
  params: {
    field: () =>
      import('./BuildTemplatePickerExtension').then(m =>
        createFormField({
          name: 'BuildTemplatePicker',
          component: m.BuildTemplatePicker,
          validation: m.buildTemplatePickerValidation,
        }),
      ),
  },
});
