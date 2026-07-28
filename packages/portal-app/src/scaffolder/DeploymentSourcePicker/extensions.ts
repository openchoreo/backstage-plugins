import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createScaffolderFieldExtension } from '@backstage/plugin-scaffolder-react';
import {
  DeploymentSourcePicker,
  DeploymentSourcePickerSchema,
} from './DeploymentSourcePicker';

export const DeploymentSourcePickerFieldExtension = scaffolderPlugin.provide(
  createScaffolderFieldExtension({
    name: 'DeploymentSourcePicker',
    component: DeploymentSourcePicker,
    schema: DeploymentSourcePickerSchema,
  }),
);
