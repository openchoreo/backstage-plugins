import { useEffect, useState, useCallback } from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import type { FieldValidation } from '@rjsf/utils';
import { YamlEditor } from '@openchoreo/backstage-plugin-react';
import YAML from 'yaml';
import { useStyles } from './styles';

const DEFAULT_CLUSTER_TRAIT_TEMPLATE = {
  apiVersion: 'openchoreo.dev/v1alpha1',
  kind: 'ClusterTrait',
  metadata: {
    name: '',
    annotations: {
      'openchoreo.dev/display-name': '',
      'openchoreo.dev/description': '',
    },
  },
  spec: {
    schema: {
      parameters: {},
    },
    creates: [],
    patches: [],
  },
};

function generateInitialYaml(formData: Record<string, unknown>): string {
  const name = (formData?.clustertrait_name as string) || '';
  const description = (formData?.description as string) || '';

  const template = structuredClone(DEFAULT_CLUSTER_TRAIT_TEMPLATE);
  template.metadata.name = name;
  template.metadata.annotations['openchoreo.dev/display-name'] = name;
  template.metadata.annotations['openchoreo.dev/description'] = description;

  return YAML.stringify(template, { indent: 2 });
}

export const ClusterTraitYamlEditorExtension = ({
  onChange,
  rawErrors,
  formContext,
  formData,
}: FieldExtensionComponentProps<string>) => {
  const classes = useStyles();
  const [errorText, setErrorText] = useState<string | undefined>();

  // Generate initial YAML from step 1 values only if the field has no existing value.
  // formData is preserved by the scaffolder across step navigation, so this ensures
  // user edits are not overwritten when moving back and forth between steps.
  useEffect(() => {
    if (formData === null && formContext?.formData) {
      const initialYaml = generateInitialYaml(formContext.formData);
      onChange(initialYaml);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = useCallback(
    (content: string) => {
      onChange(content);

      // Validate YAML on change
      try {
        YAML.parse(content);
        setErrorText(undefined);
      } catch (err) {
        setErrorText(`YAML parse error: ${err}`);
      }
    },
    [onChange],
  );

  const content = formData || '';

  return (
    <div>
      <div className={classes.helpText}>
        <span>
          Customize the ClusterTrait definition below. This resource is
          cluster-scoped and shared across all namespaces. For available fields
          and configuration options, see the{' '}
          <a
            className={classes.helpLink}
            href="https://openchoreo.dev/docs/reference/api/platform/clustertrait/"
            target="_blank"
            rel="noopener noreferrer"
          >
            ClusterTrait documentation
          </a>
          .
        </span>
      </div>
      <div className={classes.container}>
        <YamlEditor
          content={content}
          onChange={handleChange}
          errorText={errorText}
        />
      </div>
      {rawErrors && rawErrors.length > 0 && (
        <div className={classes.errorText}>{rawErrors.join(', ')}</div>
      )}
    </div>
  );
};

export const clusterTraitYamlEditorValidation = (
  value: string,
  validation: FieldValidation,
) => {
  if (!value || value.trim() === '') {
    validation.addError('ClusterTrait YAML definition is required');
    return;
  }

  try {
    const parsed = YAML.parse(value);
    if (!parsed || typeof parsed !== 'object') {
      validation.addError('YAML content must be a valid object');
      return;
    }
    if (parsed.kind !== 'ClusterTrait') {
      validation.addError('Kind must be ClusterTrait');
    }
    if (!parsed.apiVersion) {
      validation.addError('apiVersion is required');
    }
    if (!parsed.metadata?.name) {
      validation.addError('metadata.name is required');
    }
  } catch (err) {
    validation.addError(`Invalid YAML: ${err}`);
  }
};
