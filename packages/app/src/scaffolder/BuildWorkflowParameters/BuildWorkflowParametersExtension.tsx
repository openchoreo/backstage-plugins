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

/*
 Schema for the Build Workflow Parameters Field
*/
export const BuildWorkflowParametersSchema = {
  returnValue: {
    type: 'object' as const,
    additionalProperties: true,
  },
};

/*
 This component dynamically renders form fields based on the selected workflow's JSONSchema
 using RJSF (React JSON Schema Form) to handle complex types like arrays, nested objects, etc.
*/
export const BuildWorkflowParameters = ({
  onChange,
  rawErrors,
  formData,
  formContext,
}: FieldExtensionComponentProps<Record<string, any>>) => {
  const [workflowSchema, setWorkflowSchema] = useState<JSONSchema7 | null>(null);
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

  // Handle form data changes from RJSF
  const handleFormChange = (changeEvent: any) => {
    onChange(changeEvent.formData || {});
  };

  if (!selectedWorkflowName) {
    return (
      <Box mt={2}>
        <Typography variant="body2" color="textSecondary">
          Please select a workflow first
        </Typography>
      </Box>
    );
  }

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

  if (!workflowSchema || !workflowSchema.properties || Object.keys(workflowSchema.properties).length === 0) {
    return (
      <Box mt={2}>
        <Typography variant="body2" color="textSecondary">
          No additional parameters required for this workflow
        </Typography>
      </Box>
    );
  }

  return (
    <Box mt={2}>
      <Typography variant="subtitle1" gutterBottom>
        Workflow Parameters
      </Typography>
      <Form
        schema={workflowSchema}
        formData={formData || {}}
        onChange={handleFormChange}
        validator={validator}
        liveValidate={false}
        showErrorList={false}
        noHtml5Validate
      >
        {/* Hide the default submit button - we're just using this for the form fields */}
        <div style={{ display: 'none' }} />
      </Form>
      {rawErrors?.length ? (
        <Box mt={1}>
          <Typography variant="body2" color="error">
            {rawErrors.join(', ')}
          </Typography>
        </Box>
      ) : null}
    </Box>
  );
};

/*
 Validation function for workflow parameters
 RJSF handles validation based on the schema, so this is just a placeholder
*/
export const buildWorkflowParametersValidation = (
  _value: Record<string, any>,
  _validation: any,
) => {
  // Validation is handled by RJSF using the workflow schema
};
