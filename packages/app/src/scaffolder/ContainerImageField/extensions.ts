import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createScaffolderFieldExtension } from '@backstage/plugin-scaffolder-react';
import {
  ContainerImageField,
  ContainerImageFieldSchema,
  containerImageFieldValidation,
} from './ContainerImageField';

export const ContainerImageFieldExtension = scaffolderPlugin.provide(
  createScaffolderFieldExtension({
    name: 'ContainerImageField',
    component: ContainerImageField,
    schema: ContainerImageFieldSchema,
    validation: containerImageFieldValidation,
  }),
);
