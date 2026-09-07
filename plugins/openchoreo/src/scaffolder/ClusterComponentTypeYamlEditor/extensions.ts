import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';

export const ClusterComponentTypeYamlEditorFieldExtension = FormFieldBlueprint.make({
  name: 'cluster-component-type-yaml-editor',
  params: {
    field: () =>
      import('./ClusterComponentTypeYamlEditorExtension').then(m =>
        createFormField({
          name: 'ClusterComponentTypeYamlEditor',
          component: m.ClusterComponentTypeYamlEditorExtension,
          validation: m.clusterComponentTypeYamlEditorValidation,
        }),
      ),
  },
});
