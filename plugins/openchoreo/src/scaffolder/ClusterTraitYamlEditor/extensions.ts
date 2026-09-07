import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';

export const ClusterTraitYamlEditorFieldExtension = FormFieldBlueprint.make({
  name: 'cluster-trait-yaml-editor',
  params: {
    field: () =>
      import('./ClusterTraitYamlEditorExtension').then(m =>
        createFormField({
          name: 'ClusterTraitYamlEditor',
          component: m.ClusterTraitYamlEditorExtension,
          validation: m.clusterTraitYamlEditorValidation,
        }),
      ),
  },
});
