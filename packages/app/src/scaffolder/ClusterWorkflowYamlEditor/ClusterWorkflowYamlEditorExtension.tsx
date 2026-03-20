import { useEffect, useState, useCallback } from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import type { FieldValidation } from '@rjsf/utils';
import { YamlEditor } from '@openchoreo/backstage-plugin-react';
import YAML from 'yaml';
import { useStyles } from './styles';

const DEFAULT_CLUSTER_WORKFLOW_TEMPLATE = {
  apiVersion: 'openchoreo.dev/v1alpha1',
  kind: 'ClusterWorkflow',
  metadata: {
    name: '',
    annotations: {} as Record<string, string>,
    labels: {} as Record<string, string>,
  },
  spec: {
    workflowPlaneRef: {
      kind: 'ClusterWorkflowPlane',
      name: 'default',
    },
    runTemplate: {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'Workflow',
      metadata: {
        name: '${metadata.workflowRunName}',
        namespace: '${metadata.namespace}',
      },
      spec: {
        serviceAccountName: 'workflow-sa',
        entrypoint: 'main',
        templates: [
          {
            name: 'main',
            container: {
              image: 'alpine',
              command: ['echo', 'hello'],
            },
          },
        ],
      },
    },
  },
};

function generateInitialYaml(formData: Record<string, unknown>): string {
  const name = (formData?.clusterworkflow_name as string) || '';
  const displayName = (formData?.displayName as string) || '';
  const description = (formData?.description as string) || '';
  const isComponentWorkflow = formData?.is_component_workflow === true;

  const template = structuredClone(DEFAULT_CLUSTER_WORKFLOW_TEMPLATE);
  template.metadata.name = name;
  if (displayName) {
    template.metadata.annotations['openchoreo.dev/display-name'] = displayName;
  }
  if (description) {
    template.metadata.annotations['openchoreo.dev/description'] = description;
  }
  if (isComponentWorkflow) {
    template.metadata.labels['openchoreo.dev/workflow-type'] = 'component';
  }

  return YAML.stringify(template, { indent: 2 });
}

export const ClusterWorkflowYamlEditorExtension = ({
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
      const initialYaml = generateInitialYaml(formContext.formData);
      onChange(initialYaml);
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
      // If YAML is invalid, don't try to sync
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
          Customize the ClusterWorkflow definition below. This resource is
          cluster-scoped and shared across all namespaces. For available fields
          and configuration options, see the{' '}
          <a
            className={classes.helpLink}
            href="https://openchoreo.dev/docs/reference/api/platform/clusterworkflow/"
            target="_blank"
            rel="noopener noreferrer"
          >
            ClusterWorkflow documentation
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

export const clusterWorkflowYamlEditorValidation = (
  value: string,
  validation: FieldValidation,
) => {
  if (!value || value.trim() === '') {
    validation.addError('ClusterWorkflow YAML definition is required');
    return;
  }

  try {
    const parsed = YAML.parse(value);
    if (!parsed || typeof parsed !== 'object') {
      validation.addError('YAML content must be a valid object');
      return;
    }
    if (parsed.kind !== 'ClusterWorkflow') {
      validation.addError('Kind must be ClusterWorkflow');
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
