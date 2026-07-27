import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createScaffolderFieldExtension } from '@backstage/plugin-scaffolder-react';
import { DeploymentPipelinePicker } from './DeploymentPipelinePickerExtension';

export const DeploymentPipelinePickerFieldExtension = scaffolderPlugin.provide(
  createScaffolderFieldExtension({
    name: 'DeploymentPipelinePicker',
    component: DeploymentPipelinePicker,
  }),
);
