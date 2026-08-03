import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createScaffolderFieldExtension } from '@backstage/plugin-scaffolder-react';
import {
  EnvironmentFormWithYamlExtension,
  EnvironmentFormWithYamlSchema,
  environmentFormWithYamlValidation,
} from './EnvironmentFormWithYamlExtension';

export const EnvironmentFormWithYamlFieldExtension = scaffolderPlugin.provide(
  createScaffolderFieldExtension({
    name: 'EnvironmentFormWithYaml',
    component: EnvironmentFormWithYamlExtension,
    schema: EnvironmentFormWithYamlSchema,
    validation: environmentFormWithYamlValidation,
  }),
);
