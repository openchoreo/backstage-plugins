import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';

export const BuildTemplateParametersFieldExtension = FormFieldBlueprint.make({
  name: 'build-template-parameters',
  params: {
    field: () =>
      import('./BuildTemplateParametersExtension').then(m =>
        createFormField({
          name: 'BuildTemplateParameters',
          component: m.BuildTemplateParameters,
          validation: m.buildTemplateParametersValidation,
        }),
      ),
  },
});
