import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';

export const TraitsFieldExtension = FormFieldBlueprint.make({
  name: 'traits-field',
  params: {
    field: () =>
      import('./TraitsFieldExtension').then(m =>
        createFormField({
          name: 'TraitsField',
          component: m.TraitsField,
          validation: m.traitsFieldValidation,
        }),
      ),
  },
});
