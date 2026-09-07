import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';

export const NamespaceEntityPickerFieldExtension = FormFieldBlueprint.make({
  name: 'namespace-entity-picker',
  params: {
    field: () =>
      import('./NamespaceEntityPicker').then(m =>
        createFormField({
          name: 'NamespaceEntityPicker',
          component: m.NamespaceEntityPicker,
        }),
      ),
  },
});
