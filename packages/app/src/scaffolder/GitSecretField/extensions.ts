import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createScaffolderFieldExtension } from '@backstage/plugin-scaffolder-react';
import {
  GitSecretField,
  GitSecretFieldSchema,
  gitSecretFieldValidation,
} from './GitSecretField';

export const GitSecretFieldExtension = scaffolderPlugin.provide(
  createScaffolderFieldExtension({
    name: 'GitSecretField',
    component: GitSecretField,
    schema: GitSecretFieldSchema,
    validation: gitSecretFieldValidation,
  }),
);
