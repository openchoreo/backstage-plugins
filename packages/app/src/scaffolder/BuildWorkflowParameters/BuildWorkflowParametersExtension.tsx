import { useEffect, useState } from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import {
  TextField,
  FormControl,
  FormHelperText,
  Typography,
  Box,
  Checkbox,
  FormControlLabel,
} from '@material-ui/core';
import {
  useApi,
  discoveryApiRef,
  identityApiRef,
} from '@backstage/core-plugin-api';
import { JSONSchema7, JSONSchema7TypeName } from 'json-schema';

/*
 Schema for the Build Workflow Parameters Field
*/
export const BuildWorkflowParametersSchema = {
  returnValue: {
    type: 'object' as const,
    additionalProperties: true,
  },
};

interface FlattenedField {
  path: string; // dot-notation path like "docker.context"
  displayName: string; // human-readable name
  type: JSONSchema7TypeName | JSONSchema7TypeName[];
  required: boolean;
  default?: any;
  description?: string;
  parentPath?: string; // parent object path (e.g., "docker" for "docker.context")
  parentTitle?: string; // parent object title for subsection heading
}

/*
 This component dynamically renders form fields based on the selected workflow's JSONSchema
*/
export const BuildWorkflowParameters = ({
  onChange,
  rawErrors,
  formData,
  formContext,
  idSchema,
}: FieldExtensionComponentProps<Record<string, any>>) => {
  const [fields, setFields] = useState<FlattenedField[]>([]);
  const [values, setValues] = useState<Record<string, any>>(formData || {});
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
        setFields([]);
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

        // Flatten the schema into form fields
        const flattenedFields = flattenSchema(schema);

        if (!ignore) {
          setFields(flattenedFields);

          // Initialize default values
          const newValues: Record<string, any> = { ...values };
          flattenedFields.forEach(field => {
            if (!(field.path in newValues) && field.default !== undefined) {
              newValues[field.path] = field.default;
            }
          });
          setValues(newValues);
          onChange(newValues);
        }
      } catch (err) {
        if (!ignore) {
          setError(`Failed to fetch workflow schema: ${err}`);
          setFields([]);
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

  const handleFieldChange = (fieldPath: string, value: any) => {
    const newValues = { ...values, [fieldPath]: value };
    setValues(newValues);
    onChange(newValues);
  };

  const renderField = (field: FlattenedField) => {
    const value = values[field.path] || '';
    const fieldId = `${idSchema?.$id}-${field.path.replace(/\./g, '-')}`;
    const fieldType = Array.isArray(field.type) ? field.type[0] : field.type;

    switch (fieldType) {
      case 'boolean':
        return (
          <Box>
            <FormControlLabel
              control={
                <Checkbox
                  checked={value === true || value === 'true'}
                  onChange={e => handleFieldChange(field.path, e.target.checked)}
                  name={field.path}
                />
              }
              label={field.displayName}
            />
            {field.description && (
              <FormHelperText style={{ marginLeft: 32 }}>
                {field.description}
              </FormHelperText>
            )}
          </Box>
        );

      case 'number':
      case 'integer':
        return (
          <TextField
            id={fieldId}
            label={field.displayName}
            type="number"
            value={value}
            onChange={e =>
              handleFieldChange(
                field.path,
                fieldType === 'integer'
                  ? parseInt(e.target.value, 10)
                  : parseFloat(e.target.value),
              )
            }
            fullWidth
            required={field.required}
            placeholder={
              field.default !== undefined ? `${field.default}` : undefined
            }
            helperText={field.description}
            error={!!rawErrors?.find(err => err.includes(field.path))}
          />
        );

      default: // string or unspecified
        return (
          <TextField
            id={fieldId}
            label={field.displayName}
            value={value}
            onChange={e => handleFieldChange(field.path, e.target.value)}
            fullWidth
            required={field.required}
            placeholder={
              field.default !== undefined ? `${field.default}` : undefined
            }
            helperText={field.description}
            error={!!rawErrors?.find(err => err.includes(field.path))}
          />
        );
    }
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

  if (fields.length === 0) {
    return (
      <Box mt={2}>
        <Typography variant="body2" color="textSecondary">
          No additional parameters required for this workflow
        </Typography>
      </Box>
    );
  }

  // Group fields by parent path for subsection rendering
  const groupedFields: { [parentPath: string]: FlattenedField[] } = {};
  const topLevelFields: FlattenedField[] = [];

  fields.forEach(field => {
    if (field.parentPath) {
      if (!groupedFields[field.parentPath]) {
        groupedFields[field.parentPath] = [];
      }
      groupedFields[field.parentPath].push(field);
    } else {
      topLevelFields.push(field);
    }
  });

  return (
    <FormControl fullWidth margin="normal">
      <Typography variant="subtitle1" gutterBottom>
        Workflow Parameters
      </Typography>
      <Box display="flex" flexDirection="column">
        {/* Render top-level fields first */}
        {topLevelFields.map((field, index) => (
          <Box key={field.path} mb={index < topLevelFields.length - 1 || Object.keys(groupedFields).length > 0 ? 2 : 0}>
            {renderField(field)}
          </Box>
        ))}

        {/* Render grouped fields with subsection titles */}
        {Object.entries(groupedFields).map(([parentPath, parentFields], groupIndex) => {
          const parentTitle = parentFields[0]?.parentTitle || formatFieldName(parentPath);
          return (
            <Box key={parentPath} mt={groupIndex === 0 && topLevelFields.length > 0 ? 2 : 0} mb={2}>
              <Typography variant="subtitle2" style={{ fontWeight: 600, marginBottom: 8 }}>
                {parentTitle}
              </Typography>
              <Box pl={2} borderLeft="2px solid #e0e0e0">
                {parentFields.map((field, index) => (
                  <Box key={field.path} mb={index < parentFields.length - 1 ? 2 : 0}>
                    {renderField(field)}
                  </Box>
                ))}
              </Box>
            </Box>
          );
        })}
      </Box>
      {rawErrors?.length ? (
        <FormHelperText error>{rawErrors.join(', ')}</FormHelperText>
      ) : null}
    </FormControl>
  );
};

/**
 * Flatten nested JSONSchema into a list of form fields with dot-notation paths
 * Example: { docker: { context: "..." } } becomes "docker.context"
 * Tracks parent object information for grouping in UI
 */
function flattenSchema(
  schema: JSONSchema7,
  parentPath: string = '',
  parentRequired: string[] = [],
  parentTitle?: string,
): FlattenedField[] {
  const fields: FlattenedField[] = [];

  if (!schema.properties) {
    return fields;
  }

  const required = schema.required || [];

  Object.entries(schema.properties).forEach(([key, propDef]) => {
    if (typeof propDef === 'boolean') {
      return; // Skip boolean schema definitions
    }

    const prop = propDef as JSONSchema7;
    const fullPath = parentPath ? `${parentPath}.${key}` : key;
    const isRequired = required.includes(key) || parentRequired.includes(fullPath);

    // If property is an object, recursively flatten it
    if (prop.type === 'object' && prop.properties) {
      const objectTitle = prop.title || formatFieldName(key);
      const nestedFields = flattenSchema(prop, fullPath, required, objectTitle);
      fields.push(...nestedFields);
    } else {
      // Add primitive field with parent info
      fields.push({
        path: fullPath,
        displayName: prop.title || formatFieldName(key),
        type: prop.type || 'string',
        required: isRequired,
        default: prop.default,
        description: prop.description,
        parentPath: parentPath || undefined,
        parentTitle: parentTitle,
      });
    }
  });

  return fields;
}

/**
 * Format a dot-notation path into a human-readable display name
 * Example: "docker.context" -> "Docker Context"
 */
function formatFieldName(path: string): string {
  return path
    .split('.')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/*
 Validation function for workflow parameters
*/
export const buildWorkflowParametersValidation = (
  value: Record<string, any>,
  _validation: any,
) => {
  // Required field validation is handled by the schema's required array
  // Additional custom validation can be added here if needed
  if (!value) {
    return;
  }

  // Validate that required fields have values
  Object.entries(value).forEach(([_key, val]) => {
    if (val === undefined || val === null || val === '') {
      // This will be caught by the schema's required validation
      return;
    }
  });
};
