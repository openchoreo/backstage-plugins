import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createScaffolderFieldExtension } from '@backstage/plugin-scaffolder-react';
import {
  GitSourceField,
  GitSourceFieldSchema,
  gitSourceFieldValidation,
} from './GitSourceField';

export const GitSourceFieldExtension = scaffolderPlugin.provide(
  createScaffolderFieldExtension({
    name: 'GitSourceField',
    component: GitSourceField,
    schema: GitSourceFieldSchema,
    validation: gitSourceFieldValidation,
  }),
);
