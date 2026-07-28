import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createScaffolderFieldExtension } from '@backstage/plugin-scaffolder-react';
import {
  AdvancedConfigurationField,
  AdvancedConfigurationFieldSchema,
  advancedConfigurationFieldValidation,
} from './AdvancedConfigurationField';

export const AdvancedConfigurationFieldExtension = scaffolderPlugin.provide(
  createScaffolderFieldExtension({
    name: 'AdvancedConfigurationField',
    component: AdvancedConfigurationField,
    schema: AdvancedConfigurationFieldSchema,
    validation: advancedConfigurationFieldValidation,
  }),
);
