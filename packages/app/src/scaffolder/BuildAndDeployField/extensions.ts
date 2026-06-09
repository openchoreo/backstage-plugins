import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createScaffolderFieldExtension } from '@backstage/plugin-scaffolder-react';
import {
  BuildAndDeployField,
  BuildAndDeployFieldSchema,
} from './BuildAndDeployField';

export const BuildAndDeployFieldExtension = scaffolderPlugin.provide(
  createScaffolderFieldExtension({
    name: 'BuildAndDeployField',
    component: BuildAndDeployField,
    schema: BuildAndDeployFieldSchema,
  }),
);
