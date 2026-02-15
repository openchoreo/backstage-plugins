import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createScaffolderFieldExtension } from '@backstage/plugin-scaffolder-react';
import {
  ComponentWorkflowYamlEditorExtension,
  componentWorkflowYamlEditorValidation,
} from './ComponentWorkflowYamlEditorExtension';

export const ComponentWorkflowYamlEditorFieldExtension =
  scaffolderPlugin.provide(
    createScaffolderFieldExtension({
      name: 'ComponentWorkflowYamlEditor',
      component: ComponentWorkflowYamlEditorExtension,
      validation: componentWorkflowYamlEditorValidation,
    }),
  );
