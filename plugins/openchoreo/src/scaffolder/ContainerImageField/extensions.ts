import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';

export const ContainerImageFieldExtension = FormFieldBlueprint.make({
  name: 'container-image-field',
  params: {
    field: () =>
      import('./ContainerImageField').then(m =>
        createFormField({
          name: 'ContainerImageField',
          component: m.ContainerImageField,
          schema: m.ContainerImageFieldSchema as any,
          validation: m.containerImageFieldValidation,
        }),
      ),
  },
});
