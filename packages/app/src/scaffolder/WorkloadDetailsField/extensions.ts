import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createScaffolderFieldExtension } from '@backstage/plugin-scaffolder-react';
import {
  WorkloadDetailsField,
  WorkloadDetailsFieldSchema,
  workloadDetailsFieldValidation,
} from './WorkloadDetailsField';

export const WorkloadDetailsFieldExtension = scaffolderPlugin.provide(
  createScaffolderFieldExtension({
    name: 'WorkloadDetailsField',
    component: WorkloadDetailsField,
    schema: WorkloadDetailsFieldSchema,
    validation: workloadDetailsFieldValidation,
  }),
);
