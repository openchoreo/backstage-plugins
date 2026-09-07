import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';

export const ProjectTypeYamlEditorFieldExtension = FormFieldBlueprint.make({
  name: 'project-type-yaml-editor',
  params: {
    field: () =>
      import('./ProjectTypeYamlEditorExtension').then(m =>
        createFormField({
          name: 'ProjectTypeYamlEditor',
          component: m.ProjectTypeYamlEditorExtension,
          validation: m.projectTypeYamlEditorValidation,
        }),
      ),
  },
});
