import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createScaffolderFieldExtension } from '@backstage/plugin-scaffolder-react';
import {
  ResourceYamlEditorExtension,
  resourceYamlEditorValidation,
} from './ResourceYamlEditorExtension';

export const ResourceYamlEditorFieldExtension = scaffolderPlugin.provide(
  createScaffolderFieldExtension({
    name: 'ResourceYamlEditor',
    component: ResourceYamlEditorExtension,
    validation: resourceYamlEditorValidation,
  }),
);
