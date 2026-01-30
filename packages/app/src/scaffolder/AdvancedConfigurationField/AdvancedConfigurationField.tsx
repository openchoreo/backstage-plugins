import { useMemo, useState } from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import {
  Typography,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  makeStyles,
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { JSONSchema7 } from 'json-schema';
import Form from '@rjsf/material-ui';
import validator from '@rjsf/validator-ajv8';
import { generateUiSchemaWithTitles } from '../utils/rjsfUtils';

const useStyles = makeStyles(theme => ({
  accordion: {
    marginTop: theme.spacing(2),
    '&:before': {
      display: 'none',
    },
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
  },
  accordionSummary: {
    backgroundColor: theme.palette.background.default,
  },
  chip: {
    marginLeft: theme.spacing(1),
  },
  accordionDetails: {
    display: 'block',
  },
}));

/**
 * Schema for the Advanced Configuration Field
 */
export const AdvancedConfigurationFieldSchema = {
  returnValue: {
    type: 'object' as const,
    additionalProperties: true,
  },
};

/**
 * AdvancedConfigurationField component
 *
 * Splits schema properties into essential (always visible) and advanced (collapsible) sections.
 * Fields are considered "advanced" if they have a 'ui:advanced' property set to true
 * in the schema or uiSchema.
 */
export const AdvancedConfigurationField = ({
  onChange,
  formData,
  schema,
  uiSchema,
}: FieldExtensionComponentProps<Record<string, any>>) => {
  const classes = useStyles();
  const [expanded, setExpanded] = useState(false);

  // Split schema properties into essential and advanced
  const {
    essentialSchema,
    advancedSchema,
    essentialUiSchema,
    advancedUiSchema,
  } = useMemo(() => {
    const essential: JSONSchema7 = {
      type: 'object',
      properties: {},
      required: [],
    };
    const advanced: JSONSchema7 = {
      type: 'object',
      properties: {},
      required: [],
    };
    const essentialUi: Record<string, any> = {};
    const advancedUi: Record<string, any> = {};

    const schemaProperties = (schema as JSONSchema7).properties || {};
    const schemaRequired = (schema as JSONSchema7).required || [];

    Object.entries(schemaProperties).forEach(([key, prop]) => {
      if (typeof prop === 'boolean') return;

      // Check if field is marked as advanced
      const isAdvanced =
        (prop as any)['ui:advanced'] === true ||
        uiSchema?.[key]?.['ui:advanced'] === true;

      if (isAdvanced) {
        advanced.properties![key] = prop;
        if (schemaRequired.includes(key)) {
          (advanced.required as string[]).push(key);
        }
        if (uiSchema?.[key]) {
          advancedUi[key] = uiSchema[key];
        }
      } else {
        essential.properties![key] = prop;
        if (schemaRequired.includes(key)) {
          (essential.required as string[]).push(key);
        }
        if (uiSchema?.[key]) {
          essentialUi[key] = uiSchema[key];
        }
      }
    });

    // Generate UI schemas with sanitized titles
    const generatedEssentialUi = {
      ...generateUiSchemaWithTitles(essential),
      ...essentialUi,
    };
    const generatedAdvancedUi = {
      ...generateUiSchemaWithTitles(advanced),
      ...advancedUi,
    };

    return {
      essentialSchema: essential,
      advancedSchema: advanced,
      essentialUiSchema: generatedEssentialUi,
      advancedUiSchema: generatedAdvancedUi,
    };
  }, [schema, uiSchema]);

  const essentialFieldCount = Object.keys(
    essentialSchema.properties || {},
  ).length;
  const advancedFieldCount = Object.keys(
    advancedSchema.properties || {},
  ).length;

  // Handle form changes - merge both essential and advanced form data
  const handleEssentialChange = (changeEvent: any) => {
    onChange({
      ...formData,
      ...changeEvent.formData,
    });
  };

  const handleAdvancedChange = (changeEvent: any) => {
    onChange({
      ...formData,
      ...changeEvent.formData,
    });
  };

  // Extract form data for each section
  const essentialFormData = useMemo(() => {
    const data: Record<string, any> = {};
    Object.keys(essentialSchema.properties || {}).forEach(key => {
      if (formData?.[key] !== undefined) {
        data[key] = formData[key];
      }
    });
    return data;
  }, [formData, essentialSchema]);

  const advancedFormData = useMemo(() => {
    const data: Record<string, any> = {};
    Object.keys(advancedSchema.properties || {}).forEach(key => {
      if (formData?.[key] !== undefined) {
        data[key] = formData[key];
      }
    });
    return data;
  }, [formData, advancedSchema]);

  return (
    <Box>
      {/* Essential fields - always visible */}
      {essentialFieldCount > 0 && (
        <Form
          schema={essentialSchema}
          uiSchema={essentialUiSchema}
          formData={essentialFormData}
          onChange={handleEssentialChange}
          validator={validator}
          liveValidate={false}
          showErrorList={false}
          noHtml5Validate
          tagName="div"
        >
          <div style={{ display: 'none' }} />
        </Form>
      )}

      {/* Advanced fields - collapsible */}
      {advancedFieldCount > 0 && (
        <Accordion
          expanded={expanded}
          onChange={() => setExpanded(!expanded)}
          className={classes.accordion}
          elevation={0}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            className={classes.accordionSummary}
          >
            <Typography variant="subtitle2">Advanced Configuration</Typography>
            <Chip
              label={advancedFieldCount}
              size="small"
              color="default"
              className={classes.chip}
            />
          </AccordionSummary>
          <AccordionDetails className={classes.accordionDetails}>
            <Typography variant="body2" color="textSecondary" paragraph>
              These settings have sensible defaults. Modify only if needed.
            </Typography>
            <Form
              schema={advancedSchema}
              uiSchema={advancedUiSchema}
              formData={advancedFormData}
              onChange={handleAdvancedChange}
              validator={validator}
              liveValidate={false}
              showErrorList={false}
              noHtml5Validate
              tagName="div"
            >
              <div style={{ display: 'none' }} />
            </Form>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Handle case where there are no fields at all */}
      {essentialFieldCount === 0 && advancedFieldCount === 0 && (
        <Typography variant="body2" color="textSecondary">
          No configuration required for this component type.
        </Typography>
      )}
    </Box>
  );
};

/**
 * Validation function for advanced configuration field
 * RJSF handles validation automatically
 */
export const advancedConfigurationFieldValidation = (
  _value: Record<string, any>,
  _validation: any,
) => {
  // RJSF handles validation automatically
};
