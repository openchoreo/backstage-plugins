/*
  This is where the magic happens and creates the custom field extension.
*/

import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createScaffolderFieldExtension } from '@backstage/plugin-scaffolder-react';
import {
  ComponentNamePicker,
  componentNamePickerValidation,
} from './ComponentNamePickerExtension';

export const ComponentNamePickerFieldExtension = scaffolderPlugin.provide(
  createScaffolderFieldExtension({
    name: 'ComponentNamePicker',
    component: ComponentNamePicker,
    validation: componentNamePickerValidation,
  }),
);
