import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createScaffolderFieldExtension } from '@backstage/plugin-scaffolder-react';
import {
  ClusterComponentTypeYamlEditorExtension,
  clusterComponentTypeYamlEditorValidation,
} from './ClusterComponentTypeYamlEditorExtension';

export const ClusterComponentTypeYamlEditorFieldExtension =
  scaffolderPlugin.provide(
    createScaffolderFieldExtension({
      name: 'ClusterComponentTypeYamlEditor',
      component: ClusterComponentTypeYamlEditorExtension,
      validation: clusterComponentTypeYamlEditorValidation,
    }),
  );
