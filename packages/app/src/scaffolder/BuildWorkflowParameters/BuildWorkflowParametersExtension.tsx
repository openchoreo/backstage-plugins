import { useEffect, useState, useRef, useMemo } from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import { Typography, Box } from '@material-ui/core';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import {
  CHOREO_ANNOTATIONS,
  filterEmptyObjectProperties,
  parseWorkflowParametersAnnotation,
} from '@openchoreo/backstage-plugin-common';
import { JSONSchema7 } from 'json-schema';
import Form from '@rjsf/material-ui';
import validator from '@rjsf/validator-ajv8';
import { generateUiSchemaWithTitles } from '../utils/rjsfUtils';
import createSchemaUtils from '@rjsf/utils/lib/createSchemaUtils';

/**
 * Extract top-level property names to remove from the RJSF schema based on
 * the WORKFLOW_PARAMETERS annotation. Values are dot-delimited paths like
 * "parameters.repository.url" — we strip the "parameters." prefix and take the
 * first segment (e.g., "repository", "scope") as the top-level property to filter.
 */
function getAnnotationFilteredProperties(annotation: string): Set<string> {
  const mapping = parseWorkflowParametersAnnotation(annotation);
  const properties = new Set<string>();
  for (const path of Object.values(mapping)) {
    const withoutPrefix = path.startsWith('parameters.')
      ? path.slice('parameters.'.length)
      : path;
    const firstSegment = withoutPrefix.split('.')[0];
    if (firstSegment) {
      properties.add(firstSegment);
    }
  }
  return properties;
}

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
  uiSchema,
}: FieldExtensionComponentProps<WorkflowParametersData>) => {
  const [workflowSchema, setWorkflowSchema] = useState<JSONSchema7 | null>(
    null,
  );
  const [rjsfUiSchema, setRjsfUiSchema] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track workflow changes to force Form remount only when workflow actually changes
  const [resetKey, setResetKey] = useState(0);
  const prevWorkflowRef = useRef<string | undefined>(undefined);

  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const catalogApi = useApi(catalogApiRef);

  // Get the selected workflow from sibling field in the same section
  const selectedWorkflowName = formContext?.formData?.workflow_name;
  // Get namespace from ui:options (set by the converter) or fall back to form data
  const namespaceName =
    (typeof uiSchema?.['ui:options']?.namespaceName === 'string'
      ? uiSchema['ui:options'].namespaceName
      : undefined) ||
    formContext?.formData?.project_namespace?.namespace_name ||
    formContext?.formData?.namespace_name;

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
        const baseUrl = await discoveryApi.getBaseUrl(
          'openchoreo-workflows-backend',
        );
        // Use fetchApi which automatically injects Backstage + IDP tokens
        const response = await fetchApi.fetch(
          `${baseUrl}/workflows/${encodeURIComponent(
            selectedWorkflowName,
          )}/schema?namespaceName=${encodeURIComponent(nsName)}`,
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const schemaResponse = await response.json();

        let schema: JSONSchema7 = schemaResponse;

        if (!ignore) {
          // Filter out empty object properties (objects with no properties defined)
          // This prevents rendering empty sections in the RJSF form
          schema = filterEmptyObjectProperties(schema);

          // Strip systemParameters from the schema — these are now standalone
          // fields in the wizard (repo URL, branch, app path) managed by the converter
          if (schema.properties?.systemParameters) {
            const { systemParameters, ...restProperties } = schema.properties;
            schema = {
              ...schema,
              properties: restProperties,
            };
            // Also remove from required array if present
            if (schema.required) {
              schema.required = schema.required.filter(
                r => r !== 'systemParameters',
              );
            }
          }

          // Unwrap the parameters wrapper — the API returns schema with
          // developer params nested under a "parameters" key, but RJSF should
          // render the inner properties directly (e.g., docker.context).
          // The parameters nesting is re-added by componentResourceBuilder.
          if (
            schema.properties?.parameters &&
            typeof schema.properties.parameters === 'object' &&
            'properties' in (schema.properties.parameters as JSONSchema7)
          ) {
            const innerParams = schema.properties.parameters as JSONSchema7;
            schema = {
              ...schema,
              ...innerParams,
              properties: innerParams.properties,
            };
          }

          // Filter out properties that are mapped in the WORKFLOW_PARAMETERS
          // annotation — these are rendered by GitSourceField or handled
          // implicitly (projectName, componentName), so they shouldn't appear
          // as duplicate fields in the RJSF form.
          try {
            const workflowEntities = await catalogApi.getEntities({
              filter: {
                kind: 'Workflow',
                'metadata.name': selectedWorkflowName,
                ...(nsName && { 'metadata.namespace': nsName }),
              },
            });

            if (ignore) return;

            const workflowEntity = workflowEntities.items[0];
            const annotation =
              workflowEntity?.metadata?.annotations?.[
                CHOREO_ANNOTATIONS.WORKFLOW_PARAMETERS
              ];
            if (annotation && schema.properties) {
              const propsToRemove = getAnnotationFilteredProperties(annotation);
              const filteredProperties = { ...schema.properties };
              for (const prop of propsToRemove) {
                delete filteredProperties[prop];
              }
              schema = {
                ...schema,
                properties: filteredProperties,
              };
              // Also remove from required array if present
              if (schema.required) {
                schema.required = schema.required.filter(
                  r => !propsToRemove.has(r),
                );
              }
            }
          } catch {
            // If catalog lookup fails, proceed without filtering
          }

          setWorkflowSchema(schema);
          // Generate UI schema with sanitized titles for fields without explicit titles
          const generatedUiSchema = generateUiSchemaWithTitles(schema);

          setRjsfUiSchema(generatedUiSchema);
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
  }, [selectedWorkflowName, namespaceName, discoveryApi, fetchApi, catalogApi]);

  // Sync schema to formData when workflow changes (not just when schema loads).
  // Compute default values from the schema so they are always included — RJSF
  // does not fire onChange on initial render, so without this, users who accept
  // defaults without editing get parameters: {}.
  useEffect(() => {
    if (!workflowSchema) return;

    const schemaUtils = createSchemaUtils(validator, workflowSchema, {
      emptyObjectFields: 'populateAllDefaults',
    });
    const defaults =
      (schemaUtils.getDefaultFormState(workflowSchema, {}) as Record<
        string,
        any
      >) || {};

    if (resetKey > 0) {
      // Workflow changed: initialize with schema defaults
      onChange({
        parameters: defaults,
        schema: workflowSchema,
      });
    } else if (!formData?.schema) {
      // First time loading: merge existing parameters over defaults
      onChange({
        parameters: { ...defaults, ...(formData?.parameters || {}) },
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

  // Custom RJSF fields for specialized input types
  // Must be defined before any early returns to satisfy React's rules of hooks
  const customFields = useMemo(() => ({}), []);

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
    return null;
  }

  return (
    workflowSchema && (
      <Box mt={2}>
        <Form
          key={resetKey}
          schema={workflowSchema}
          uiSchema={rjsfUiSchema}
          formData={formData?.parameters || {}}
          onChange={handleFormChange}
          validator={validator}
          liveValidate={false}
          showErrorList={false}
          noHtml5Validate
          tagName="div"
          fields={customFields}
          formContext={formContext}
          experimental_defaultFormStateBehavior={{
            emptyObjectFields: 'populateAllDefaults',
          }}
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
