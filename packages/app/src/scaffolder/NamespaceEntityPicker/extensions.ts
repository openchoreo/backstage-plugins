import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createScaffolderFieldExtension } from '@backstage/plugin-scaffolder-react';
import { NamespaceEntityPicker } from './NamespaceEntityPicker';

export const NamespaceEntityPickerFieldExtension = scaffolderPlugin.provide(
  createScaffolderFieldExtension({
    name: 'NamespaceEntityPicker',
    component: NamespaceEntityPicker,
  }),
);
