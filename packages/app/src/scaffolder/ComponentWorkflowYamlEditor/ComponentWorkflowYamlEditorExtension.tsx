import { useEffect, useState, useCallback } from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import type { FieldValidation } from '@rjsf/utils';
import { YamlEditor } from '@openchoreo/backstage-plugin-react';
import YAML from 'yaml';
import { useStyles } from './styles';

const DEFAULT_WORKFLOW_TEMPLATE = {
  apiVersion: 'openchoreo.dev/v1alpha1',
  kind: 'Workflow',
  metadata: {
    name: '',
    namespace: '',
    annotations: {} as Record<string, string>,
    labels: {} as Record<string, string>,
  },
  spec: {
    schema: {
      parameters: {},
    },
    runTemplate: {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'Workflow',
      metadata: {
        name: '${metadata.workflowRunName}',
        namespace: 'openchoreo-ci-${metadata.namespaceName}',
      },
      spec: {
        arguments: {
          parameters: [] as Array<{ name: string; value: string }>,
        },
        serviceAccountName: 'workflow-sa',
        workflowTemplateRef: {
          clusterScope: true,
          name: '',
        },
      },
    },
  },
};

function generateInitialYaml(formData: Record<string, unknown>): string {
  const name = (formData?.componentworkflow_name as string) || '';
  const namespaceName = (formData?.namespace_name as string) || '';
  const description = (formData?.description as string) || '';
  const isComponentWorkflow = formData?.is_component_workflow === true;

  // Extract namespace from entity reference format (e.g., "domain:default/my-namespace" -> "my-namespace")
  const extractName = (fullName: string): string => {
    const parts = fullName.split('/');
    return parts[parts.length - 1];
  };

  const template = structuredClone(DEFAULT_WORKFLOW_TEMPLATE);
  template.metadata.name = name;
  template.metadata.namespace = extractName(namespaceName);
  if (description) {
    template.metadata.annotations['openchoreo.dev/description'] = description;
  }
  if (isComponentWorkflow) {
    template.metadata.labels['openchoreo.dev/workflow-type'] = 'component';
  }

  return YAML.stringify(template, { indent: 2 });
}

export const ComponentWorkflowYamlEditorExtension = ({
  onChange,
  rawErrors,
  formContext,
  formData,
}: FieldExtensionComponentProps<string>) => {
  const classes = useStyles();
  const [errorText, setErrorText] = useState<string | undefined>();

  const isComponentWorkflow =
    formContext?.formData?.is_component_workflow === true;

  // Generate initial YAML or sync workflow-type label on mount.
  // This runs each time the step mounts (e.g., navigating back and forth between steps).
  useEffect(() => {
    if (!formContext?.formData) {
      return;
    }

    if (!formData) {
      // No existing YAML — generate from scratch
      onChange(generateInitialYaml(formContext.formData));
      return;
    }

    // Existing YAML — sync the workflow-type label with the toggle
    try {
      const parsed = YAML.parse(formData);
      if (!parsed?.metadata) {
        return;
      }
      if (!parsed.metadata.labels) {
        parsed.metadata.labels = {};
      }

      const hasLabel =
        parsed.metadata.labels['openchoreo.dev/workflow-type'] === 'component';

      if (isComponentWorkflow && !hasLabel) {
        parsed.metadata.labels['openchoreo.dev/workflow-type'] = 'component';
        onChange(YAML.stringify(parsed, { indent: 2 }));
      } else if (!isComponentWorkflow && hasLabel) {
        delete parsed.metadata.labels['openchoreo.dev/workflow-type'];
        onChange(YAML.stringify(parsed, { indent: 2 }));
      }
    } catch {
      // Don't modify if YAML is invalid
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
          Customize the Workflow definition below. For available fields and
          configuration options, see the{' '}
          <a
            className={classes.helpLink}
            href="https://openchoreo.dev/docs/reference/api/platform/workflow/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Workflow documentation
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

export const componentWorkflowYamlEditorValidation = (
  value: string,
  validation: FieldValidation,
) => {
  if (!value || value.trim() === '') {
    validation.addError('Workflow YAML definition is required');
    return;
  }

  try {
    const parsed = YAML.parse(value);
    if (!parsed || typeof parsed !== 'object') {
      validation.addError('YAML content must be a valid object');
      return;
    }
    if (parsed.kind !== 'Workflow') {
      validation.addError('Kind must be Workflow');
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
