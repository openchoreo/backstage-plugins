import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';

export const AdvancedConfigurationFieldExtension = FormFieldBlueprint.make({
  name: 'advanced-configuration-field',
  params: {
    field: () =>
      import('./AdvancedConfigurationField').then(m =>
        createFormField({
          name: 'AdvancedConfigurationField',
          component: m.AdvancedConfigurationField,
          schema: m.AdvancedConfigurationFieldSchema as any,
          validation: m.advancedConfigurationFieldValidation,
        }),
      ),
  },
});
