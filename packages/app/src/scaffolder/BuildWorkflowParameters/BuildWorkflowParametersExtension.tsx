import { useEffect, useState, useRef } from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import { Typography, Box } from '@material-ui/core';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { JSONSchema7 } from 'json-schema';
import Form from '@rjsf/material-ui';
import validator from '@rjsf/validator-ajv8';
import { generateUiSchemaWithTitles } from '../utils/rjsfUtils';
import { filterEmptyObjectProperties } from '@openchoreo/backstage-plugin-common';

/*
 Schema for the Build Workflow Parameters Field
*/
export const BuildWorkflowParametersSchema = {
  returnValue: {
    type: 'object' as const,
    additionalProperties: true,
  },
};

/**
 * Interface for the workflow parameters with schema included
 */
export interface WorkflowParametersData {
  parameters: Record<string, any>;
  schema?: JSONSchema7;
}

/*
 This component dynamically renders form fields based on the selected workflow's JSONSchema
 using RJSF (React JSON Schema Form) to handle complex types like arrays, nested objects, etc.
*/
export const BuildWorkflowParameters = ({
  onChange,
  formData,
  formContext,
}: FieldExtensionComponentProps<WorkflowParametersData>) => {
  const [workflowSchema, setWorkflowSchema] = useState<JSONSchema7 | null>(
    null,
  );
  const [uiSchema, setUiSchema] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track workflow changes to force Form remount only when workflow actually changes
  const [resetKey, setResetKey] = useState(0);
  const prevWorkflowRef = useRef<string | undefined>(undefined);

  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  // Get the selected workflow and namespace from form data
  // The workflow_name is a sibling field in the same section
  const selectedWorkflowName = formContext?.formData?.workflow_name;
  const namespaceName = formContext?.formData?.namespace_name;

  // Increment resetKey only when workflow actually changes
  // This forces Form remount only on workflow change, not on every render
  useEffect(() => {
    if (
      prevWorkflowRef.current !== undefined &&
      prevWorkflowRef.current !== selectedWorkflowName
    ) {
      setResetKey(prev => prev + 1);
    }
    prevWorkflowRef.current = selectedWorkflowName;
  }, [selectedWorkflowName]);

  // Fetch workflow schema when workflow selection changes
  useEffect(() => {
    let ignore = false;

    const fetchWorkflowSchema = async () => {
      if (!selectedWorkflowName || !namespaceName) {
        setWorkflowSchema(null);
        setError(null);
        return;
      }

      // Extract the actual namespace name from the entity reference format
      const extractNsName = (fullNsName: string): string => {
        const parts = fullNsName.split('/');
        return parts[parts.length - 1];
      };

      const nsName = extractNsName(namespaceName);

      setLoading(true);
      setError(null);

      try {
        const baseUrl = await discoveryApi.getBaseUrl('openchoreo-ci-backend');
        // Use fetchApi which automatically injects Backstage + IDP tokens
        const response = await fetchApi.fetch(
          `${baseUrl}/workflow-schema?namespaceName=${encodeURIComponent(
            nsName,
          )}&workflowName=${encodeURIComponent(selectedWorkflowName)}`,
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const schemaResponse = await response.json();
        if (!schemaResponse.success || !schemaResponse.data) {
          throw new Error('Invalid schema response');
        }

        let schema: JSONSchema7 = schemaResponse.data;

        if (!ignore) {
          // Filter out empty object properties (objects with no properties defined)
          // This prevents rendering empty sections in the RJSF form
          schema = filterEmptyObjectProperties(schema);

          setWorkflowSchema(schema);
          // Generate UI schema with sanitized titles for fields without explicit titles
          const generatedUiSchema = generateUiSchemaWithTitles(schema);

          // Hide systemParameters.repository.revision.commit field from the form
          // This field is set dynamically when triggering the workflow
          if (!generatedUiSchema.systemParameters) {
            generatedUiSchema.systemParameters = {};
          }
          if (!generatedUiSchema.systemParameters.repository) {
            generatedUiSchema.systemParameters.repository = {};
          }
          if (!generatedUiSchema.systemParameters.repository.revision) {
            generatedUiSchema.systemParameters.repository.revision = {};
          }
          generatedUiSchema.systemParameters.repository.revision.commit = {
            'ui:widget': 'hidden',
          };

          setUiSchema(generatedUiSchema);
        }
      } catch (err) {
        if (!ignore) {
          setError(`Failed to fetch workflow schema: ${err}`);
          setWorkflowSchema(null);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchWorkflowSchema();
    return () => {
      ignore = true;
    };
  }, [selectedWorkflowName, namespaceName, discoveryApi, fetchApi]);

  // Sync schema to formData when workflow changes (not just when schema loads)
  useEffect(() => {
    if (workflowSchema && resetKey > 0) {
      // Clear old parameters only when workflow actually changes (resetKey increments)
      // This prevents clearing when user navigates back to this step
      onChange({
        parameters: {},
        schema: workflowSchema,
      });
    } else if (workflowSchema && resetKey === 0 && !formData?.schema) {
      // First time loading: initialize with existing or empty parameters
      onChange({
        parameters: formData?.parameters || {},
        schema: workflowSchema,
      });
    }
    // We intentionally only depend on workflowSchema and resetKey.
    // Adding onChange or formData would cause infinite re-renders:
    // onChange -> formData changes -> useEffect triggers -> onChange -> loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowSchema, resetKey]);

  // Handle form data changes from RJSF
  const handleFormChange = (changeEvent: any) => {
    // Store parameters and schema together
    onChange({
      parameters: changeEvent.formData || {},
      schema: workflowSchema || undefined,
    });
  };

  if (loading) {
    return (
      <Box mt={2}>
        <Typography variant="body2" color="textSecondary">
          Loading workflow parameters...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box mt={2}>
        <Typography variant="body2" color="error">
          {error}
        </Typography>
      </Box>
    );
  }

  if (
    selectedWorkflowName &&
    (!workflowSchema ||
      !workflowSchema.properties ||
      Object.keys(workflowSchema.properties).length === 0)
  ) {
    return (
      <Box mt={2}>
        <Typography variant="body2" color="textSecondary">
          No additional parameters required for this workflow
        </Typography>
      </Box>
    );
  }

  return (
    workflowSchema && (
      <Box mt={2}>
        <Typography variant="subtitle1" gutterBottom>
          Workflow Parameters
        </Typography>
        <Form
          key={resetKey}
          schema={workflowSchema}
          uiSchema={uiSchema}
          formData={formData?.parameters || {}}
          onChange={handleFormChange}
          validator={validator}
          liveValidate={false}
          showErrorList={false}
          noHtml5Validate
          tagName="div"
        >
          {/* Hide the default submit button - we're just using this for the form fields */}
          <div style={{ display: 'none' }} />
        </Form>
      </Box>
    )
  );
};

/**
 * Validation function for workflow parameters
 * Note: RJSF handles validation automatically when tagName="div" is set.
 * This function is kept for any additional custom validation if needed in the future.
 */
export const buildWorkflowParametersValidation = (
  _value: WorkflowParametersData | any,
  _validation: any,
) => {
  // RJSF handles validation automatically - no custom validation needed
};
