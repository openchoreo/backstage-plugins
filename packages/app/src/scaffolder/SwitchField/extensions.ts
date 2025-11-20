import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createScaffolderFieldExtension } from '@backstage/plugin-scaffolder-react';
import { SwitchField, SwitchFieldSchema } from './SwitchFieldExtension';

export const SwitchFieldExtension = scaffolderPlugin.provide(
  createScaffolderFieldExtension({
    name: 'SwitchField',
    component: SwitchField,
    schema: SwitchFieldSchema,
  }),
);
