import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createScaffolderFieldExtension } from '@backstage/plugin-scaffolder-react';
import {
  ResourceTypeYamlEditorExtension,
  resourceTypeYamlEditorValidation,
} from './ResourceTypeYamlEditorExtension';

export const ResourceTypeYamlEditorFieldExtension = scaffolderPlugin.provide(
  createScaffolderFieldExtension({
    name: 'ResourceTypeYamlEditor',
    component: ResourceTypeYamlEditorExtension,
    validation: resourceTypeYamlEditorValidation,
  }),
);
