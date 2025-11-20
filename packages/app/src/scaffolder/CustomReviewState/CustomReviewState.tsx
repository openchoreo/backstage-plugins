import { StructuredMetadataTable } from '@backstage/core-components';
import { Box, Button, makeStyles } from '@material-ui/core';

const useStyles = makeStyles(theme => ({
  footer: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gridGap: theme.spacing(1),
    marginTop: theme.spacing(2),
  },
}));

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
  if (filteredFormData.workflow_parameters && typeof filteredFormData.workflow_parameters === 'object') {
    const { schema, ...rest } = filteredFormData.workflow_parameters;
    filteredFormData.workflow_parameters = rest.parameters || rest;
  }

  return (
    <>
      <StructuredMetadataTable metadata={filteredFormData} dense />
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
