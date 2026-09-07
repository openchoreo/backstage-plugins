import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';

export const TraitYamlEditorFieldExtension = FormFieldBlueprint.make({
  name: 'trait-yaml-editor',
  params: {
    field: () =>
      import('./TraitYamlEditorExtension').then(m =>
        createFormField({
          name: 'TraitYamlEditor',
          component: m.TraitYamlEditorExtension,
          validation: m.traitYamlEditorValidation,
        }),
      ),
  },
});
