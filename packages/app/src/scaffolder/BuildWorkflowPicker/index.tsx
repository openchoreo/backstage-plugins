import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createScaffolderFieldExtension } from '@backstage/plugin-scaffolder-react';
import {
  BuildWorkflowPicker,
  BuildWorkflowPickerSchema,
  buildWorkflowPickerValidation,
} from './BuildWorkflowPickerExtension';

export const BuildWorkflowPickerFieldExtension = scaffolderPlugin.provide(
  createScaffolderFieldExtension({
    name: 'BuildWorkflowPicker',
    component: BuildWorkflowPicker,
    schema: BuildWorkflowPickerSchema,
    validation: buildWorkflowPickerValidation,
  }),
);
