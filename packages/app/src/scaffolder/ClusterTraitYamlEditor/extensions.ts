import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createScaffolderFieldExtension } from '@backstage/plugin-scaffolder-react';
import {
  ClusterTraitYamlEditorExtension,
  clusterTraitYamlEditorValidation,
} from './ClusterTraitYamlEditorExtension';

export const ClusterTraitYamlEditorFieldExtension = scaffolderPlugin.provide(
  createScaffolderFieldExtension({
    name: 'ClusterTraitYamlEditor',
    component: ClusterTraitYamlEditorExtension,
    validation: clusterTraitYamlEditorValidation,
  }),
);
