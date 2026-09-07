import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';

export const NotificationChannelFormWithYamlFieldExtension = FormFieldBlueprint.make({
  name: 'notification-channel-form-with-yaml',
  params: {
    field: () =>
      import('./NotificationChannelFormWithYamlExtension').then(m =>
        createFormField({
          name: 'NotificationChannelFormWithYaml',
          component: m.NotificationChannelFormWithYamlExtension,
          schema: m.NotificationChannelFormWithYamlSchema as any,
          validation: m.notificationChannelFormWithYamlValidation,
        }),
      ),
  },
});
