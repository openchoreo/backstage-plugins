import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';

export const ComponentTypeYamlEditorFieldExtension = FormFieldBlueprint.make({
  name: 'component-type-yaml-editor',
  params: {
    field: () =>
      import('./ComponentTypeYamlEditorExtension').then(m =>
        createFormField({
          name: 'ComponentTypeYamlEditor',
          component: m.ComponentTypeYamlEditorExtension,
          validation: m.componentTypeYamlEditorValidation,
        }),
      ),
  },
});
