import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';

export const BuildWorkflowParametersFieldExtension = FormFieldBlueprint.make({
  name: 'build-workflow-parameters',
  params: {
    field: () =>
      import('./BuildWorkflowParametersExtension').then(m =>
        createFormField({
          name: 'BuildWorkflowParameters',
          component: m.BuildWorkflowParameters,
          schema: m.BuildWorkflowParametersSchema as any,
          validation: m.buildWorkflowParametersValidation,
        }),
      ),
  },
});
