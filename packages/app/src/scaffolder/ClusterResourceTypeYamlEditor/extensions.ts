import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createScaffolderFieldExtension } from '@backstage/plugin-scaffolder-react';
import {
  ClusterResourceTypeYamlEditorExtension,
  clusterResourceTypeYamlEditorValidation,
} from './ClusterResourceTypeYamlEditorExtension';

export const ClusterResourceTypeYamlEditorFieldExtension =
  scaffolderPlugin.provide(
    createScaffolderFieldExtension({
      name: 'ClusterResourceTypeYamlEditor',
      component: ClusterResourceTypeYamlEditorExtension,
      validation: clusterResourceTypeYamlEditorValidation,
    }),
  );
