import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';

export const EnvironmentFormWithYamlFieldExtension = FormFieldBlueprint.make({
  name: 'environment-form-with-yaml',
  params: {
    field: () =>
      import('./EnvironmentFormWithYamlExtension').then(m =>
        createFormField({
          name: 'EnvironmentFormWithYaml',
          component: m.EnvironmentFormWithYamlExtension,
          schema: m.EnvironmentFormWithYamlSchema as any,
          validation: m.environmentFormWithYamlValidation,
        }),
      ),
  },
});
