import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createScaffolderFieldExtension } from '@backstage/plugin-scaffolder-react';
import {
  ClusterProjectTypeYamlEditorExtension,
  clusterProjectTypeYamlEditorValidation,
} from './ClusterProjectTypeYamlEditorExtension';

export const ClusterProjectTypeYamlEditorFieldExtension =
  scaffolderPlugin.provide(
    createScaffolderFieldExtension({
      name: 'ClusterProjectTypeYamlEditor',
      component: ClusterProjectTypeYamlEditorExtension,
      validation: clusterProjectTypeYamlEditorValidation,
    }),
  );
