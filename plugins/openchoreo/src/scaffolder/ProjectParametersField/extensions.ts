import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';

export const ProjectParametersFieldExtension = FormFieldBlueprint.make({
  name: 'project-parameters-field',
  params: {
    field: () =>
      import('./ProjectParametersField').then(m =>
        createFormField({
          name: 'ProjectParametersField',
          component: m.ProjectParametersField,
          schema: m.ProjectParametersFieldSchema as any,
        }),
      ),
  },
});
