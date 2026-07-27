/*
  This is where the magic happens and creates the custom field extension.
*/

import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createScaffolderFieldExtension } from '@backstage/plugin-scaffolder-react';
import {
  ResourceNamePicker,
  resourceNamePickerValidation,
} from './ResourceNamePickerExtension';

export const ResourceNamePickerFieldExtension = scaffolderPlugin.provide(
  createScaffolderFieldExtension({
    name: 'ResourceNamePicker',
    component: ResourceNamePicker,
    validation: resourceNamePickerValidation,
  }),
);
