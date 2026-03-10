import { useMemo } from 'react';
import { Box, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import Form from '@rjsf/material-ui';
import { JSONSchema7 } from 'json-schema';
import validator from '@rjsf/validator-ajv8';
import { sanitizeLabel } from '@openchoreo/backstage-plugin-common';

interface ParametersContentProps {
  schema: Record<string, unknown>;
  parameters: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
  disabled?: boolean;
}

const useStyles = makeStyles(theme => ({
  formRoot: {
    '& .MuiFormHelperText-root:not(.Mui-error)': {
      color: theme.palette.text.disabled,
      fontSize: 11,
      fontStyle: 'italic',
    },
  },
}));

/**
 * Recursively generates a UI Schema with sanitized titles and default value hints.
 */
function generateUiSchema(schema: any, formData: Record<string, unknown>): any {
  if (!schema || typeof schema !== 'object') return {};

  const uiSchema: any = {};

  if (schema.properties) {
    Object.entries(schema.properties).forEach(
      ([key, propSchema]: [string, any]) => {
        if (!propSchema || typeof propSchema !== 'object') return;

        const fieldUiSchema: any = {};

        if (!propSchema.title) {
          fieldUiSchema['ui:title'] = sanitizeLabel(key);
        }

        // Add default value hints as helper text
        if (propSchema.default !== undefined) {
          const currentValue = formData[key];
          const isDefault =
            currentValue === undefined ||
            JSON.stringify(currentValue) === JSON.stringify(propSchema.default);

          if (!isDefault) {
            const defaultStr =
              typeof propSchema.default === 'object'
                ? JSON.stringify(propSchema.default)
                : String(propSchema.default);
            fieldUiSchema['ui:help'] = `Default: ${defaultStr}`;
          }
        }

        uiSchema[key] = fieldUiSchema;

        if (propSchema.type === 'object' && propSchema.properties) {
          const nestedData = (formData[key] as Record<string, unknown>) || {};
          uiSchema[key] = {
            ...uiSchema[key],
            ...generateUiSchema(propSchema, nestedData),
          };
        }
        if (propSchema.type === 'array' && propSchema.items) {
          const itemsUiSchema = generateUiSchema(propSchema.items, {});
          if (Object.keys(itemsUiSchema).length > 0) {
            uiSchema[key] = { ...uiSchema[key], items: itemsUiSchema };
          }
        }
      },
    );
  }

  return uiSchema;
}

export const ParametersContent = ({
  schema,
  parameters,
  onChange,
  disabled,
}: ParametersContentProps) => {
  const classes = useStyles();
  const jsonSchema = schema as JSONSchema7;

  const uiSchema = useMemo(
    () => generateUiSchema(jsonSchema, parameters),
    [jsonSchema, parameters],
  );

  if (
    !jsonSchema.properties ||
    Object.keys(jsonSchema.properties).length === 0
  ) {
    return (
      <Box p={2}>
        <Typography variant="body2" color="textSecondary">
          No parameter schema available for this component type.
        </Typography>
      </Box>
    );
  }

  return (
    <Box className={classes.formRoot}>
      <Form
        schema={jsonSchema}
        uiSchema={uiSchema}
        formData={parameters}
        onChange={data => onChange(data.formData)}
        validator={validator}
        liveValidate
        showErrorList={false}
        noHtml5Validate
        omitExtraData
        tagName="div"
        disabled={disabled}
        children={<div />}
      />
    </Box>
  );
};
