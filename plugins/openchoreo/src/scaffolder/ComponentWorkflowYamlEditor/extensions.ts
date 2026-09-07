import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';

export const ComponentWorkflowYamlEditorFieldExtension = FormFieldBlueprint.make({
  name: 'component-workflow-yaml-editor',
  params: {
    field: () =>
      import('./ComponentWorkflowYamlEditorExtension').then(m =>
        createFormField({
          name: 'ComponentWorkflowYamlEditor',
          component: m.ComponentWorkflowYamlEditorExtension,
          validation: m.componentWorkflowYamlEditorValidation,
        }),
      ),
  },
});
