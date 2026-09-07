import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';

export const ClusterProjectTypeYamlEditorFieldExtension = FormFieldBlueprint.make({
  name: 'cluster-project-type-yaml-editor',
  params: {
    field: () =>
      import('./ClusterProjectTypeYamlEditorExtension').then(m =>
        createFormField({
          name: 'ClusterProjectTypeYamlEditor',
          component: m.ClusterProjectTypeYamlEditorExtension,
          validation: m.clusterProjectTypeYamlEditorValidation,
        }),
      ),
  },
});
