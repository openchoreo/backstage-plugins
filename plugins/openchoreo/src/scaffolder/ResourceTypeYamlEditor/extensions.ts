import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';

export const ResourceTypeYamlEditorFieldExtension = FormFieldBlueprint.make({
  name: 'resource-type-yaml-editor',
  params: {
    field: () =>
      import('./ResourceTypeYamlEditorExtension').then(m =>
        createFormField({
          name: 'ResourceTypeYamlEditor',
          component: m.ResourceTypeYamlEditorExtension,
          validation: m.resourceTypeYamlEditorValidation,
        }),
      ),
  },
});
