import { StructuredMetadataTable } from '@backstage/core-components';
import { Box, Button, Typography } from '@material-ui/core';
import { sanitizeLabel } from '@openchoreo/backstage-plugin-common';
import React from 'react';
import { useStyles } from './styles';

// Render a nested object as formatted key-value pairs
const NestedObjectRenderer = ({
  obj,
  classes,
}: {
  obj: Record<string, any>;
  classes: ReturnType<typeof useStyles>;
}): JSX.Element => {
  return (
    <div className={classes.nestedContainer}>
      {Object.entries(obj).map(([key, value]) => {
        if (value === null || value === undefined || value === '') {
          return null;
        }

        let displayValue: React.ReactNode;

        if (typeof value === 'boolean') {
          displayValue = value ? '✓ Yes' : '✗ No';
        } else if (typeof value === 'object' && !Array.isArray(value)) {
          displayValue = <NestedObjectRenderer obj={value} classes={classes} />;
        } else if (Array.isArray(value)) {
          displayValue = value.join(', ');
        } else {
          displayValue = String(value);
        }

        return (
          <div key={key} className={classes.nestedItem}>
            <Typography
              variant="body2"
              component="span"
              className={classes.nestedLabel}
            >
              {sanitizeLabel(key)}
            </Typography>
            <Typography
              variant="body1"
              component="span"
              className={classes.nestedValue}
            >
              {displayValue}
            </Typography>
          </div>
        );
      })}
    </div>
  );
};

// Render an array of objects (like traits)
const ArrayRenderer = ({
  items,
  itemLabelKey,
  classes,
}: {
  items: any[];
  itemLabelKey?: string;
  classes: ReturnType<typeof useStyles>;
}): JSX.Element => {
  return (
    <div className={classes.nestedContainer}>
      {items.map((item, index) => {
        const label =
          itemLabelKey && item[itemLabelKey]
            ? item[itemLabelKey]
            : `Item ${index + 1}`;

        if (typeof item === 'object' && item !== null) {
          const displayItem = itemLabelKey
            ? Object.fromEntries(
                Object.entries(item).filter(([key]) => key !== itemLabelKey),
              )
            : item;

          return (
            <div key={index} className={classes.arrayItemContainer}>
              <Typography variant="body1" className={classes.arrayItemHeader}>
                {sanitizeLabel(String(label))}
              </Typography>
              <NestedObjectRenderer obj={displayItem} classes={classes} />
            </div>
          );
        }
        return (
          <Typography key={index} variant="body1">
            {String(item)}
          </Typography>
        );
      })}
    </div>
  );
};

/**
 * Custom Review Step Component
 * Filters out internal fields before rendering:
 * - Traits: removes id, schema, uiSchema
 * - Workflow Parameters: removes schema, shows only parameters
 */
export const CustomReviewStep = ({
  formData,
  handleBack,
  handleCreate,
  disableButtons,
}: {
  formData: Record<string, any>;
  handleBack: () => void;
  handleCreate: () => void;
  handleReset?: () => void;
  disableButtons: boolean;
  steps?: any[];
}) => {
  const classes = useStyles();

  // Deep clone formData to avoid mutating original
  const filteredFormData = JSON.parse(JSON.stringify(formData));

  // Filter traits to remove internal fields
  if (filteredFormData.traits && Array.isArray(filteredFormData.traits)) {
    filteredFormData.traits = filteredFormData.traits.map((trait: any) => {
      const { id, schema, uiSchema, ...cleanTrait } = trait;
      return cleanTrait;
    });
  }

  // Filter workflow_parameters to remove schema and show only the parameters
  if (
    filteredFormData.workflow_parameters &&
    typeof filteredFormData.workflow_parameters === 'object'
  ) {
    const { schema, ...rest } = filteredFormData.workflow_parameters;
    filteredFormData.workflow_parameters = rest.parameters || rest;
  }

  // Transform nested objects and arrays into React components for proper display
  const formattedMetadata: Record<string, any> = {};

  Object.entries(filteredFormData).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      return;
    }

    if (Array.isArray(value) && value.length > 0) {
      // Handle arrays (like traits)
      if (typeof value[0] === 'object') {
        formattedMetadata[key] = (
          <ArrayRenderer items={value} itemLabelKey="name" classes={classes} />
        );
      } else {
        formattedMetadata[key] = value.join(', ');
      }
    } else if (typeof value === 'object' && value !== null) {
      // Handle nested objects (like workflow_parameters)
      formattedMetadata[key] = (
        <NestedObjectRenderer obj={value} classes={classes} />
      );
    } else if (typeof value === 'boolean') {
      formattedMetadata[key] = value ? '✓ Yes' : '✗ No';
    } else {
      formattedMetadata[key] = value;
    }
  });

  return (
    <>
      <StructuredMetadataTable metadata={formattedMetadata} dense />
      <Box className={classes.footer}>
        <Button onClick={handleBack} disabled={disableButtons}>
          Back
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleCreate}
          disabled={disableButtons}
        >
          Create
        </Button>
      </Box>
    </>
  );
};
