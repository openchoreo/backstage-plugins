import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createScaffolderFieldExtension } from '@backstage/plugin-scaffolder-react';
import {
  ProjectParametersField,
  ProjectParametersFieldSchema,
} from './ProjectParametersField';

export const ProjectParametersFieldExtension = scaffolderPlugin.provide(
  createScaffolderFieldExtension({
    name: 'ProjectParametersField',
    component: ProjectParametersField,
    schema: ProjectParametersFieldSchema,
  }),
);
