import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';

export const ClusterResourceTypeYamlEditorFieldExtension =
  FormFieldBlueprint.make({
    name: 'cluster-resource-type-yaml-editor',
    params: {
      field: () =>
        import('./ClusterResourceTypeYamlEditorExtension').then(m =>
          createFormField({
            name: 'ClusterResourceTypeYamlEditor',
            component: m.ClusterResourceTypeYamlEditorExtension,
            validation: m.clusterResourceTypeYamlEditorValidation,
          }),
        ),
    },
  });
