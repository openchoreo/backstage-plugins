import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createScaffolderFieldExtension } from '@backstage/plugin-scaffolder-react';
import {
  ProjectNamespaceField,
  ProjectNamespaceFieldSchema,
  projectNamespaceFieldValidation,
} from './ProjectNamespaceField';

export const ProjectNamespaceFieldExtension = scaffolderPlugin.provide(
  createScaffolderFieldExtension({
    name: 'ProjectNamespaceField',
    component: ProjectNamespaceField,
    schema: ProjectNamespaceFieldSchema,
    validation: projectNamespaceFieldValidation,
  }),
);
