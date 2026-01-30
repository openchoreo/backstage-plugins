import { useState, useEffect, useMemo } from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import {
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  IconButton,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core';
import DeleteIcon from '@material-ui/icons/Delete';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import Form from '@rjsf/material-ui';
import { JSONSchema7 } from 'json-schema';
import validator from '@rjsf/validator-ajv8';
import { NoTraitsAvailableMessage } from './NoTraitsAvailableMessage';
import { generateUiSchemaWithTitles } from '../utils/rjsfUtils';
import { TraitPicker } from './TraitPicker';
import { TraitListItem } from './TraitCard';

const useStyles = makeStyles(theme => ({
  accordion: {
    marginBottom: theme.spacing(1),
    '&:before': {
      display: 'none',
    },
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    '&.Mui-expanded': {
      margin: `0 0 ${theme.spacing(1)}px 0`,
    },
  },
  accordionSummary: {
    minHeight: 48,
    '&.Mui-expanded': {
      minHeight: 48,
    },
  },
  summaryContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginRight: theme.spacing(1),
  },
  traitTitle: {
    fontWeight: 500,
  },
  traitName: {
    color: theme.palette.text.secondary,
    marginLeft: theme.spacing(1),
    fontSize: '0.875rem',
  },
  deleteButton: {
    padding: theme.spacing(0.5),
  },
  accordionDetails: {
    display: 'block',
    paddingTop: 0,
  },
}));

/**
 * Schema for the Traits Field
 */
export const TraitsFieldSchema = {
  returnValue: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        instanceName: { type: 'string' },
        config: { type: 'object' },
      },
      required: ['name', 'instanceName'],
    },
  },
};

// Re-export TraitListItem from TraitCard for type consistency
export type { TraitListItem } from './TraitCard';

export interface AddedTrait {
  id: string; // Unique ID for this instance (internal tracking)
  name: string; // Trait type name
  instanceName: string; // User-editable instance name
  config: Record<string, any>;
  schema?: JSONSchema7;
  uiSchema?: any; // UI schema with sanitized field labels
}

/**
 * TraitsField component
 * Allows users to add multiple traits with their configurations
 */
export const TraitsField = ({
  onChange,
  formData,
  uiSchema,
}: FieldExtensionComponentProps<AddedTrait[]>) => {
  const classes = useStyles();
  const [availableTraits, setAvailableTraits] = useState<TraitListItem[]>([]);
  const [addedTraits, setAddedTraits] = useState<AddedTrait[]>(formData || []);
  const [loadingTraits, setLoadingTraits] = useState(false);
  const [loadingTraitName, setLoadingTraitName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedAccordion, setExpandedAccordion] = useState<string | false>(
    false,
  );

  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  // Get namespace name from ui:options
  const namespaceName =
    typeof uiSchema?.['ui:options']?.namespaceName === 'string'
      ? uiSchema['ui:options'].namespaceName
      : '';

  // Fetch available traits on mount
  useEffect(() => {
    let ignore = false;

    const fetchTraits = async () => {
      if (!namespaceName) {
        return;
      }

      setLoadingTraits(true);
      setError(null);

      try {
        const baseUrl = await discoveryApi.getBaseUrl('openchoreo');

        // Extract namespace name if it's in entity reference format
        const extractNsName = (fullNsName: string): string => {
          const parts = fullNsName.split('/');
          return parts[parts.length - 1];
        };

        const nsName = extractNsName(namespaceName);

        // Use fetchApi which automatically injects Backstage + IDP tokens
        const response = await fetchApi.fetch(
          `${baseUrl}/traits?namespaceName=${encodeURIComponent(
            nsName,
          )}&page=1&pageSize=100`,
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (!ignore && result.success) {
          setAvailableTraits(result.data.items);
        }
      } catch (err) {
        if (!ignore) {
          setError(`Failed to fetch traits: ${err}`);
        }
      } finally {
        if (!ignore) {
          setLoadingTraits(false);
        }
      }
    };

    fetchTraits();

    return () => {
      ignore = true;
    };
  }, [namespaceName, discoveryApi, fetchApi]);

  // Fetch schema for a trait and add it
  const handleAddTrait = async (traitName: string) => {
    if (!traitName || !namespaceName) {
      return;
    }

    setLoadingTraitName(traitName);
    setError(null);

    try {
      const baseUrl = await discoveryApi.getBaseUrl('openchoreo');

      // Extract namespace name
      const extractNsName = (fullNsName: string): string => {
        const parts = fullNsName.split('/');
        return parts[parts.length - 1];
      };

      const nsName = extractNsName(namespaceName);

      // Use fetchApi which automatically injects Backstage + IDP tokens
      const response = await fetchApi.fetch(
        `${baseUrl}/trait-schema?namespaceName=${encodeURIComponent(
          nsName,
        )}&traitName=${encodeURIComponent(traitName)}`,
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        const schema = result.data;
        // Generate UI schema with sanitized titles for fields without explicit titles
        const generatedUiSchema = generateUiSchemaWithTitles(schema);

        // Count existing traits of this type for instance naming
        const existingCount = addedTraits.filter(
          t => t.name === traitName,
        ).length;

        const newTrait: AddedTrait = {
          id: `${traitName}-${Date.now()}`, // Unique ID for this instance
          name: traitName,
          instanceName: `${traitName}-${existingCount + 1}`, // Default instance name
          config: {},
          schema: schema,
          uiSchema: generatedUiSchema,
        };

        const updatedTraits = [...addedTraits, newTrait];
        setAddedTraits(updatedTraits);
        onChange(updatedTraits);
        // Auto-expand the newly added trait
        setExpandedAccordion(newTrait.id);
      }
    } catch (err) {
      setError(`Failed to fetch trait schema: ${err}`);
    } finally {
      setLoadingTraitName(null);
    }
  };

  // Handle accordion expand/collapse
  const handleAccordionChange =
    (traitId: string) =>
    (_event: React.ChangeEvent<{}>, isExpanded: boolean) => {
      setExpandedAccordion(isExpanded ? traitId : false);
    };

  // Get list of added trait names for counting
  const addedTraitNames = useMemo(
    () => addedTraits.map(t => t.name),
    [addedTraits],
  );

  // Remove a trait
  const handleRemoveTrait = (id: string) => {
    const updatedTraits = addedTraits.filter(trait => trait.id !== id);
    setAddedTraits(updatedTraits);
    onChange(updatedTraits);
  };

  // Update trait instance name
  const handleInstanceNameChange = (id: string, instanceName: string) => {
    const updatedTraits = addedTraits.map(trait =>
      trait.id === id ? { ...trait, instanceName } : trait,
    );
    setAddedTraits(updatedTraits);
    onChange(updatedTraits);
  };

  // Update trait configuration
  const handleTraitConfigChange = (id: string, config: Record<string, any>) => {
    const updatedTraits = addedTraits.map(trait =>
      trait.id === id ? { ...trait, config } : trait,
    );
    setAddedTraits(updatedTraits);
    onChange(updatedTraits);
  };

  return (
    <Box mt={2} mb={2}>
      {error && (
        <Typography variant="body2" color="error" gutterBottom>
          {error}
        </Typography>
      )}

      {/* Loading state */}
      {loadingTraits && (
        <Box display="flex" alignItems="center" justifyContent="center" py={4}>
          <CircularProgress size={24} style={{ marginRight: 8 }} />
          <Typography variant="body2" color="textSecondary">
            Loading available traits...
          </Typography>
        </Box>
      )}

      {/* No Traits Available - Prominent Message */}
      {!loadingTraits && availableTraits.length === 0 && namespaceName && (
        <NoTraitsAvailableMessage />
      )}

      {/* Trait Picker - Card-based selection */}
      {!loadingTraits && availableTraits.length > 0 && (
        <TraitPicker
          availableTraits={availableTraits}
          addedTraitNames={addedTraitNames}
          onAddTrait={handleAddTrait}
          loading={loadingTraits}
          loadingTraitName={loadingTraitName || undefined}
        />
      )}

      {/* Display Added Traits */}
      {addedTraits.length > 0 && (
        <Box mt={3}>
          <Typography variant="subtitle1" gutterBottom>
            Configured Traits ({addedTraits.length})
          </Typography>
          {addedTraits.map((trait, index) => (
            <Accordion
              key={trait.id}
              expanded={expandedAccordion === trait.id}
              onChange={handleAccordionChange(trait.id)}
              className={classes.accordion}
              elevation={0}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                className={classes.accordionSummary}
              >
                <Box className={classes.summaryContent}>
                  <Box display="flex" alignItems="center">
                    <Typography className={classes.traitTitle}>
                      {trait.instanceName || `${trait.name} #${index + 1}`}
                    </Typography>
                    <Typography className={classes.traitName}>
                      ({trait.name})
                    </Typography>
                  </Box>
                  <IconButton
                    onClick={e => {
                      e.stopPropagation();
                      handleRemoveTrait(trait.id);
                    }}
                    size="small"
                    className={classes.deleteButton}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </AccordionSummary>
              <AccordionDetails className={classes.accordionDetails}>
                {/* Instance Name Field */}
                <Box mb={2}>
                  <TextField
                    label="Instance Name"
                    value={trait.instanceName || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleInstanceNameChange(trait.id, e.target.value)
                    }
                    fullWidth
                    required
                    variant="outlined"
                    size="small"
                    helperText="A unique name to identify this trait instance"
                  />
                </Box>

                {/* Trait Configuration */}
                {trait.schema && (
                  <Form
                    schema={trait.schema}
                    uiSchema={trait.uiSchema || {}}
                    formData={trait.config}
                    onChange={data =>
                      handleTraitConfigChange(trait.id, data.formData)
                    }
                    validator={validator}
                    showErrorList={false}
                    tagName="div"
                    children={<div />} // Hide submit button
                  />
                )}
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}
    </Box>
  );
};

/**
 * Validation function for traits
 * Handles custom validation logic:
 * - Unique instance names (business rule)
 * Note: RJSF handles schema validation automatically when tagName="div" is set
 */
export const traitsFieldValidation = (value: AddedTrait[], validation: any) => {
  if (!value || value.length === 0) {
    // Traits are optional, no error if empty
    return;
  }

  // Track instance names for uniqueness validation
  const instanceNames = new Set<string>();

  // Validate each trait
  value.forEach((trait, index) => {
    if (!trait.instanceName || trait.instanceName.trim() === '') {
      validation.addError(`Trait #${index + 1}: Instance name is required`);
      return;
    }

    // Check for duplicate instance names (custom business rule)
    if (instanceNames.has(trait.instanceName)) {
      validation.addError(
        `Trait #${index + 1}: Instance name "${
          trait.instanceName
        }" is already used. Each trait instance must have a unique name.`,
      );
    } else {
      instanceNames.add(trait.instanceName);
    }
  });
};
