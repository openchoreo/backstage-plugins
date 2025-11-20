import { useEffect, useState } from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import { Typography, Box } from '@material-ui/core';
import {
  useApi,
  discoveryApiRef,
  identityApiRef,
} from '@backstage/core-plugin-api';
import { JSONSchema7 } from 'json-schema';
import Form from '@rjsf/material-ui';
import validator from '@rjsf/validator-ajv8';
import { generateUiSchemaWithTitles } from '../utils/rjsfUtils';

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

  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);

  // Get the selected workflow and organization from form data
  // The workflow_name is a sibling field in the same section
  const selectedWorkflowName = formContext?.formData?.workflow_name;
  const organizationName = formContext?.formData?.organization_name;

  // Fetch workflow schema when workflow selection changes
  useEffect(() => {
    let ignore = false;

    const fetchWorkflowSchema = async () => {
      if (!selectedWorkflowName || !organizationName) {
        setWorkflowSchema(null);
        setError(null);
        return;
      }

      // Extract the actual organization name from the entity reference format
      const extractOrgName = (fullOrgName: string): string => {
        const parts = fullOrgName.split('/');
        return parts[parts.length - 1];
      };

      const orgName = extractOrgName(organizationName);

      setLoading(true);
      setError(null);

      try {
        const { token } = await identityApi.getCredentials();
        const baseUrl = await discoveryApi.getBaseUrl('openchoreo');
        const response = await fetch(
          `${baseUrl}/workflow-schema?organizationName=${encodeURIComponent(
            orgName,
          )}&workflowName=${encodeURIComponent(selectedWorkflowName)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const schemaResponse = await response.json();
        if (!schemaResponse.success || !schemaResponse.data) {
          throw new Error('Invalid schema response');
        }

        const schema: JSONSchema7 = schemaResponse.data;

        if (!ignore) {
          setWorkflowSchema(schema);
          // Generate UI schema with sanitized titles for fields without explicit titles
          const generatedUiSchema = generateUiSchemaWithTitles(schema);
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
  }, [selectedWorkflowName, organizationName, discoveryApi, identityApi]);

  // Sync schema to formData when workflow schema changes
  useEffect(() => {
    if (workflowSchema) {
      // Update formData to include the schema for validation
      onChange({
        parameters: formData?.parameters || {},
        schema: workflowSchema,
      });
    }
    // We intentionally only depend on workflowSchema to avoid infinite loop.
    // Adding onChange or formData would cause infinite re-renders:
    // onChange -> formData changes -> useEffect triggers -> onChange -> loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowSchema]);

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
