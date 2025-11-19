/*
  This is where the magic happens and creates the custom field extension for Traits.
*/

import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createScaffolderFieldExtension } from '@backstage/plugin-scaffolder-react';
import {
  TraitsField,
  traitsFieldValidation,
} from './TraitsFieldExtension';

export const TraitsFieldExtension = scaffolderPlugin.provide(
  createScaffolderFieldExtension({
    name: 'TraitsField',
    component: TraitsField,
    validation: traitsFieldValidation,
  }),
);
