import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createScaffolderFieldExtension } from '@backstage/plugin-scaffolder-react';
import {
  ComponentTypeYamlEditorExtension,
  componentTypeYamlEditorValidation,
} from './ComponentTypeYamlEditorExtension';

export const ComponentTypeYamlEditorFieldExtension = scaffolderPlugin.provide(
  createScaffolderFieldExtension({
    name: 'ComponentTypeYamlEditor',
    component: ComponentTypeYamlEditorExtension,
    validation: componentTypeYamlEditorValidation,
  }),
);
