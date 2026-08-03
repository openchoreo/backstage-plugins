import { useEffect, useRef, useState, useCallback } from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import type { FieldValidation } from '@rjsf/utils';
import { YamlEditor } from '@openchoreo/backstage-plugin-react';
import YAML from 'yaml';
import { useStyles } from './styles';

const DEFAULT_CLUSTER_PROJECT_TYPE_TEMPLATE = {
  apiVersion: 'openchoreo.dev/v1alpha1',
  kind: 'ClusterProjectType',
  metadata: {
    name: '',
    annotations: {
      'openchoreo.dev/display-name': '',
      'openchoreo.dev/description': '',
    },
  },
  spec: {
    parameters: {
      openAPIV3Schema: {
        type: 'object',
        properties: {
          tier: {
            type: 'string',
            enum: ['standard', 'premium'],
            default: 'standard',
          },
        },
      },
    },
    environmentConfigs: {
      openAPIV3Schema: {
        type: 'object',
        properties: {},
      },
    },
    // Every (Cluster)ProjectType must render a Namespace whose name resolves to
    // the project's data-plane namespace (`${metadata.namespace}`). This is the
    // cell-namespace mandate enforced by the ProjectReleaseBinding controller.
    resources: [
      {
        id: 'cell-namespace',
        template: {
          apiVersion: 'v1',
          kind: 'Namespace',
          metadata: {
            name: '${metadata.namespace}',
            labels: '${metadata.labels}',
          },
        },
      },
    ],
  },
};

function generateInitialYaml(formData: Record<string, unknown>): string {
  const name = (formData?.clusterprojecttype_name as string) || '';
  const displayName = (formData?.displayName as string) || '';
  const description = (formData?.description as string) || '';

  const template = structuredClone(DEFAULT_CLUSTER_PROJECT_TYPE_TEMPLATE);
  template.metadata.name = name;
  template.metadata.annotations['openchoreo.dev/display-name'] = displayName;
  template.metadata.annotations['openchoreo.dev/description'] = description;

  return YAML.stringify(template, { indent: 2 });
}

export const ClusterProjectTypeYamlEditorExtension = ({
  onChange,
  rawErrors,
  formContext,
  formData,
}: FieldExtensionComponentProps<string>) => {
  const classes = useStyles();
  const [errorText, setErrorText] = useState<string | undefined>();
  const lastGeneratedYamlRef = useRef<string | undefined>(undefined);

  // Generate initial YAML from step 1 values. Re-runs when formContext.formData
  // changes (e.g. user edits name/description in step 1 then returns to step 2),
  // but only overwrites the editor content when the user hasn't manually edited
  // the YAML (i.e. formData is falsy or still matches the last auto-generated value).
  useEffect(() => {
    if (formContext?.formData) {
      const generatedYaml = generateInitialYaml(formContext.formData);
      if (!formData || formData === lastGeneratedYamlRef.current) {
        onChange(generatedYaml);
        lastGeneratedYamlRef.current = generatedYaml;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formContext?.formData]);

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
          Customize the ClusterProjectType definition below. This resource is
          cluster-scoped and can be referenced by projects in any namespace. It
          must render a Namespace named{' '}
          <code>
            ${'{'}metadata.namespace{'}'}
          </code>
          . For available fields and configuration options, see the{' '}
          <a
            className={classes.helpLink}
            href="https://openchoreo.dev/docs/reference/api/platform/clusterprojecttype/"
            target="_blank"
            rel="noopener noreferrer"
          >
            ClusterProjectType documentation
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

export const clusterProjectTypeYamlEditorValidation = (
  value: string,
  validation: FieldValidation,
) => {
  if (!value || value.trim() === '') {
    validation.addError('ClusterProjectType YAML definition is required');
    return;
  }

  try {
    const parsed = YAML.parse(value);
    if (!parsed || typeof parsed !== 'object') {
      validation.addError('YAML content must be a valid object');
      return;
    }
    if (parsed.kind !== 'ClusterProjectType') {
      validation.addError('Kind must be ClusterProjectType');
    }
    if (parsed.apiVersion !== 'openchoreo.dev/v1alpha1') {
      validation.addError("apiVersion must be 'openchoreo.dev/v1alpha1'");
    }
    if (!parsed.metadata?.name) {
      validation.addError('metadata.name is required');
    }
  } catch (err) {
    validation.addError(`Invalid YAML: ${err}`);
  }
};
