import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';

export const SwitchFieldExtension = FormFieldBlueprint.make({
  name: 'switch-field',
  params: {
    field: () =>
      import('./SwitchFieldExtension').then(m =>
        createFormField({
          name: 'SwitchField',
          component: m.SwitchField,
          schema: m.SwitchFieldSchema as any,
        }),
      ),
  },
});
