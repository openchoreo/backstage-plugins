import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';

export const ResourceParametersFieldExtension = FormFieldBlueprint.make({
  name: 'resource-parameters-field',
  params: {
    field: () =>
      import('./ResourceParametersField').then(m =>
        createFormField({
          name: 'ResourceParametersField',
          component: m.ResourceParametersField,
          schema: m.ResourceParametersFieldSchema as any,
        }),
      ),
  },
});
