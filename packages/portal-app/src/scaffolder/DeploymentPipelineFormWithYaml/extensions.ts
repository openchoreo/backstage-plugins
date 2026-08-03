import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createScaffolderFieldExtension } from '@backstage/plugin-scaffolder-react';
import {
  DeploymentPipelineFormWithYamlExtension,
  DeploymentPipelineFormWithYamlSchema,
  deploymentPipelineFormWithYamlValidation,
} from './DeploymentPipelineFormWithYamlExtension';

export const DeploymentPipelineFormWithYamlFieldExtension =
  scaffolderPlugin.provide(
    createScaffolderFieldExtension({
      name: 'DeploymentPipelineFormWithYaml',
      component: DeploymentPipelineFormWithYamlExtension,
      schema: DeploymentPipelineFormWithYamlSchema,
      validation: deploymentPipelineFormWithYamlValidation,
    }),
  );
