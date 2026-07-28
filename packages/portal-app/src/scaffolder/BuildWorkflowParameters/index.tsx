import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createScaffolderFieldExtension } from '@backstage/plugin-scaffolder-react';
import {
  BuildWorkflowParameters,
  BuildWorkflowParametersSchema,
  buildWorkflowParametersValidation,
} from './BuildWorkflowParametersExtension';

export const BuildWorkflowParametersFieldExtension = scaffolderPlugin.provide(
  createScaffolderFieldExtension({
    name: 'BuildWorkflowParameters',
    component: BuildWorkflowParameters,
    schema: BuildWorkflowParametersSchema,
    validation: buildWorkflowParametersValidation,
  }),
);
