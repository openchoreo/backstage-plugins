import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createScaffolderFieldExtension } from '@backstage/plugin-scaffolder-react';
import {
  ResourceParametersField,
  ResourceParametersFieldSchema,
} from './ResourceParametersField';

export const ResourceParametersFieldExtension = scaffolderPlugin.provide(
  createScaffolderFieldExtension({
    name: 'ResourceParametersField',
    component: ResourceParametersField,
    schema: ResourceParametersFieldSchema,
  }),
);
