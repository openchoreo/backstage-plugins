/*
  This is where the magic happens and creates the custom field extension for Addons.
*/

import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createScaffolderFieldExtension } from '@backstage/plugin-scaffolder-react';
import {
  AddonsField,
  addonsFieldValidation,
} from './AddonsFieldExtension';

export const AddonsFieldExtension = scaffolderPlugin.provide(
  createScaffolderFieldExtension({
    name: 'AddonsField',
    component: AddonsField,
    validation: addonsFieldValidation,
  }),
);
