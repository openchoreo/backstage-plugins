import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createScaffolderFieldExtension } from '@backstage/plugin-scaffolder-react';
import {
  ProjectTypeYamlEditorExtension,
  projectTypeYamlEditorValidation,
} from './ProjectTypeYamlEditorExtension';

export const ProjectTypeYamlEditorFieldExtension = scaffolderPlugin.provide(
  createScaffolderFieldExtension({
    name: 'ProjectTypeYamlEditor',
    component: ProjectTypeYamlEditorExtension,
    validation: projectTypeYamlEditorValidation,
  }),
);
