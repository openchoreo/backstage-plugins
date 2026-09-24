import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import type { FieldValidation } from '@rjsf/utils';
import { Box } from '@material-ui/core';
import {
  RepoCreationFields,
  RepoCreationConfig,
} from '../GitSourceField/RepoCreationFields';
import type { GitSourceData } from '../GitSourceField/GitSourceField';

export const RepoCreateFieldSchema = {
  returnValue: {
    type: 'object' as const,
    additionalProperties: true,
  },
};

/**
 * Standalone "create a new repository" field. Reuses RepoCreationFields with
 * providers supplied via `ui:options.repoCreation` in the template.
 */
export const RepoCreateField = ({
  onChange,
  formData,
  uiSchema,
  rawErrors,
}: FieldExtensionComponentProps<GitSourceData>) => {
  const config = uiSchema?.['ui:options']?.repoCreation as
    | RepoCreationConfig
    | undefined;

  const data: GitSourceData = {
    repo_url: '',
    branch: formData?.branch ?? 'main',
    component_path: formData?.component_path ?? '.',
    git_secret_ref: '',
    mode: 'create',
    provider: formData?.provider ?? '',
    repo_host: formData?.repo_host ?? '',
    repoUrl: formData?.repoUrl ?? '',
    owner: formData?.owner ?? '',
    repo_name: formData?.repo_name ?? '',
    visibility: formData?.visibility ?? 'private',
    runtime: formData?.runtime ?? '',
    starter_url: formData?.starter_url ?? '',
  };

  if (!config?.providers?.length) return null;

  return (
    <Box>
      <RepoCreationFields
        data={data}
        config={config}
        onChange={onChange}
        hasError={!!rawErrors?.length}
      />
    </Box>
  );
};

export const repoCreateFieldValidation = (
  value: GitSourceData,
  validation: FieldValidation,
) => {
  if (!value?.owner?.trim()) {
    validation.addError('Owner / Organization is required');
  }
  if (!value?.repo_name?.trim()) {
    validation.addError('Repository name is required');
  }
  if (!value?.repoUrl?.trim()) {
    validation.addError('Repository details are incomplete');
  }
};
