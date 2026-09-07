import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';

export const ProjectNamespaceFieldExtension = FormFieldBlueprint.make({
  name: 'project-namespace-field',
  params: {
    field: () =>
      import('./ProjectNamespaceField').then(m =>
        createFormField({
          name: 'ProjectNamespaceField',
          component: m.ProjectNamespaceField,
          schema: m.ProjectNamespaceFieldSchema as any,
          validation: m.projectNamespaceFieldValidation,
        }),
      ),
  },
});
