import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createScaffolderFieldExtension } from '@backstage/plugin-scaffolder-react';
import {
  NotificationChannelFormWithYamlExtension,
  NotificationChannelFormWithYamlSchema,
  notificationChannelFormWithYamlValidation,
} from './NotificationChannelFormWithYamlExtension';

export const NotificationChannelFormWithYamlFieldExtension =
  scaffolderPlugin.provide(
    createScaffolderFieldExtension({
      name: 'NotificationChannelFormWithYaml',
      component: NotificationChannelFormWithYamlExtension,
      schema: NotificationChannelFormWithYamlSchema,
      validation: notificationChannelFormWithYamlValidation,
    }),
  );
