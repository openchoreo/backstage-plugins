import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';

export const ClusterWorkflowYamlEditorFieldExtension = FormFieldBlueprint.make({
  name: 'cluster-workflow-yaml-editor',
  params: {
    field: () =>
      import('./ClusterWorkflowYamlEditorExtension').then(m =>
        createFormField({
          name: 'ClusterWorkflowYamlEditor',
          component: m.ClusterWorkflowYamlEditorExtension,
          validation: m.clusterWorkflowYamlEditorValidation,
        }),
      ),
  },
});
