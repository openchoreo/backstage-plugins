import type { FC } from 'react';
import { Box, Typography, Button } from '@material-ui/core';
import DeleteIcon from '@material-ui/icons/Delete';
import Form from '@rjsf/material-ui';
import validator from '@rjsf/validator-ajv8';
import { JSONSchema7 } from 'json-schema';
import { makeStyles } from '@material-ui/core/styles';
import { sanitizeLabel } from '@openchoreo/backstage-plugin-common';

const useStyles = makeStyles(theme => ({
  container: {
    padding: theme.spacing(0),
  },
  formCard: {
    padding: theme.spacing(3),
    backgroundColor: theme.palette.common.white,
    borderRadius: theme.spacing(1),
    border: `1px solid ${theme.palette.divider}`,
    marginBottom: theme.spacing(2),
  },
  deleteButton: {
    marginTop: theme.spacing(2),
  },
}));

/**
 * Recursively generates a UI Schema with sanitized titles for all fields
 * that don't already have a title in the JSON Schema.
 */
function generateUiSchemaWithSanitizedTitles(schema: any): any {
  if (!schema || typeof schema !== 'object') {
    return {};
  }

  const uiSchema: any = {};

  // Handle object properties
  if (schema.properties) {
    Object.entries(schema.properties).forEach(
      ([key, propSchema]: [string, any]) => {
        if (!propSchema || typeof propSchema !== 'object') {
          return;
        }

        const fieldUiSchema: any = {};

        // If the property doesn't have a title, add sanitized one
        if (!propSchema.title) {
          fieldUiSchema['ui:title'] = sanitizeLabel(key);
        }

        // Recursively handle nested objects
        if (propSchema.properties) {
          Object.assign(
            fieldUiSchema,
            generateUiSchemaWithSanitizedTitles(propSchema),
          );
        }

        // Handle array items
        if (propSchema.items && propSchema.items.properties) {
          fieldUiSchema.items = generateUiSchemaWithSanitizedTitles(
            propSchema.items,
          );
        }

        if (Object.keys(fieldUiSchema).length > 0) {
          uiSchema[key] = fieldUiSchema;
        }
      },
    );
  }

  return uiSchema;
}

interface OverrideContentProps {
  title: string;
  contentTitle?: React.ReactNode;
  /** Optional title to display inside the form card */
  sectionTitle?: React.ReactNode;
  schema: JSONSchema7 | null;
  formData: any;
  onChange: (formData: any) => void;
  onDelete: () => void;
  hasInitialData: boolean;
  disabled?: boolean;
  customContent?: React.ReactNode;
  /** Whether to wrap custom content in form card (default: true for schema forms, false for custom content) */
  wrapCustomContent?: boolean;
  /** Enable live validation to highlight required fields */
  showValidation?: boolean;
}

export const OverrideContent: FC<OverrideContentProps> = ({
  title,
  contentTitle,
  sectionTitle,
  schema,
  formData,
  onChange,
  onDelete,
  hasInitialData,
  customContent,
  wrapCustomContent = false,
  disabled = false,
  showValidation = false,
}) => {
  const classes = useStyles();

  const handleFormChange = (e: any) => {
    onChange(e.formData);
  };

  const renderContent = () => {
    if (customContent) {
      return (
        <>
          {contentTitle}
          {wrapCustomContent ? (
            <Box className={classes.formCard}>
              {sectionTitle}
              {customContent}
            </Box>
          ) : (
            <>
              {sectionTitle}
              {customContent}
            </>
          )}
          <Button
            onClick={onDelete}
            color="secondary"
            startIcon={<DeleteIcon />}
            disabled={!hasInitialData || disabled}
            className={classes.deleteButton}
            size="small"
          >
            Delete {title}
          </Button>
        </>
      );
    }

    if (schema) {
      // Generate UI schema with sanitized field labels
      const uiSchema = generateUiSchemaWithSanitizedTitles(schema);

      return (
        <>
          {contentTitle}
          <Box className={classes.formCard}>
            {sectionTitle}
            <Form
              schema={schema}
              uiSchema={uiSchema}
              formData={formData}
              onChange={handleFormChange}
              validator={validator}
              liveValidate={showValidation}
              showErrorList={false}
              noHtml5Validate
              disabled={disabled}
            >
              <div />
            </Form>
          </Box>

          <Button
            onClick={onDelete}
            color="secondary"
            startIcon={<DeleteIcon />}
            disabled={!hasInitialData || disabled}
            className={classes.deleteButton}
            size="small"
          >
            Delete {title}
          </Button>
        </>
      );
    }

    return (
      <Typography variant="body2" color="textSecondary">
        No override schema available for this section.
      </Typography>
    );
  };

  return <Box className={classes.container}>{renderContent()}</Box>;
};
