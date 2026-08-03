import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createScaffolderFieldExtension } from '@backstage/plugin-scaffolder-react';
import {
  ClusterWorkflowYamlEditorExtension,
  clusterWorkflowYamlEditorValidation,
} from './ClusterWorkflowYamlEditorExtension';

export const ClusterWorkflowYamlEditorFieldExtension = scaffolderPlugin.provide(
  createScaffolderFieldExtension({
    name: 'ClusterWorkflowYamlEditor',
    component: ClusterWorkflowYamlEditorExtension,
    validation: clusterWorkflowYamlEditorValidation,
  }),
);
