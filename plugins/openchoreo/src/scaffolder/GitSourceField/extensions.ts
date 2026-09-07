import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';

export const GitSourceFieldExtension = FormFieldBlueprint.make({
  name: 'git-source-field',
  params: {
    field: () =>
      import('./GitSourceField').then(m =>
        createFormField({
          name: 'GitSourceField',
          component: m.GitSourceField,
          schema: m.GitSourceFieldSchema as any,
          validation: m.gitSourceFieldValidation,
        }),
      ),
  },
});
