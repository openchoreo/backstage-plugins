import { useState, useEffect } from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  FormControl,
  FormHelperText,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@material-ui/core';
import DeleteIcon from '@material-ui/icons/Delete';
import AddIcon from '@material-ui/icons/Add';
import {
  useApi,
  discoveryApiRef,
  identityApiRef,
} from '@backstage/core-plugin-api';
import Form from '@rjsf/material-ui';
import { JSONSchema7 } from 'json-schema';
import validator from '@rjsf/validator-ajv8';
import { NoTraitsAvailableMessage } from './NoTraitsAvailableMessage';
import { generateUiSchemaWithTitles } from '../utils/rjsfUtils';

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

interface TraitListItem {
  name: string;
  createdAt: string;
}

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
  rawErrors,
  formData,
  uiSchema,
}: FieldExtensionComponentProps<AddedTrait[]>) => {
  const [availableTraits, setAvailableTraits] = useState<TraitListItem[]>([]);
  const [addedTraits, setAddedTraits] = useState<AddedTrait[]>(formData || []);
  const [selectedTrait, setSelectedTrait] = useState<string>('');
  const [loadingTraits, setLoadingTraits] = useState(false);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);

  // Get organization name from ui:options
  const organizationName =
    typeof uiSchema?.['ui:options']?.organizationName === 'string'
      ? uiSchema['ui:options'].organizationName
      : '';

  // Fetch available traits on mount
  useEffect(() => {
    let ignore = false;

    const fetchTraits = async () => {
      if (!organizationName) {
        return;
      }

      setLoadingTraits(true);
      setError(null);

      try {
        const { token } = await identityApi.getCredentials();
        const baseUrl = await discoveryApi.getBaseUrl('openchoreo');

        // Extract organization name if it's in entity reference format
        const extractOrgName = (fullOrgName: string): string => {
          const parts = fullOrgName.split('/');
          return parts[parts.length - 1];
        };

        const orgName = extractOrgName(organizationName);

        const response = await fetch(
          `${baseUrl}/traits?organizationName=${encodeURIComponent(
            orgName,
          )}&page=1&pageSize=100`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
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
  }, [organizationName, discoveryApi, identityApi]);

  // Fetch schema for selected trait and add it
  const handleAddTrait = async () => {
    if (!selectedTrait || !organizationName) {
      return;
    }

    setLoadingSchema(true);
    setError(null);

    try {
      const { token } = await identityApi.getCredentials();
      const baseUrl = await discoveryApi.getBaseUrl('openchoreo');

      // Extract organization name
      const extractOrgName = (fullOrgName: string): string => {
        const parts = fullOrgName.split('/');
        return parts[parts.length - 1];
      };

      const orgName = extractOrgName(organizationName);

      const response = await fetch(
        `${baseUrl}/trait-schema?organizationName=${encodeURIComponent(
          orgName,
        )}&traitName=${encodeURIComponent(selectedTrait)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        const schema = result.data;
        // Generate UI schema with sanitized titles for fields without explicit titles
        const generatedUiSchema = generateUiSchemaWithTitles(schema);

        const newTrait: AddedTrait = {
          id: `${selectedTrait}-${Date.now()}`, // Unique ID for this instance
          name: selectedTrait,
          instanceName: `${selectedTrait}-${addedTraits.length + 1}`, // Default instance name
          config: {},
          schema: schema,
          uiSchema: generatedUiSchema,
        };

        const updatedTraits = [...addedTraits, newTrait];
        setAddedTraits(updatedTraits);
        onChange(updatedTraits);
        setSelectedTrait(''); // Reset selection
      }
    } catch (err) {
      setError(`Failed to fetch trait schema: ${err}`);
    } finally {
      setLoadingSchema(false);
    }
  };

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

      {/* No Traits Available - Prominent Message */}
      {!loadingTraits && availableTraits.length === 0 && organizationName && (
        <NoTraitsAvailableMessage />
      )}

      {/* Trait Selection - Only show when traits are available or loading */}
      {(loadingTraits || availableTraits.length > 0) && (
        <Box display="flex" alignItems="center" mt={2} mb={3}>
        <FormControl fullWidth variant="outlined" disabled={loadingTraits || loadingSchema} style={{ marginRight: 16 }}>
          <InputLabel>Select a Trait</InputLabel>
          <Select
            label="Select a Trait"
            value={selectedTrait}
            onChange={e => setSelectedTrait(e.target.value as string)}
          >
              {loadingTraits && (
                <MenuItem disabled>
                  <CircularProgress size={20} style={{ marginRight: 8 }} />
                  Loading traits...
                </MenuItem>
              )}
              {!loadingTraits && availableTraits.length === 0 && (
                <MenuItem disabled>
                  {organizationName
                    ? 'No traits available'
                    : 'Select an organization first'}
                </MenuItem>
              )}
              {!loadingTraits &&
                availableTraits.map(trait => (
                  <MenuItem key={trait.name} value={trait.name}>
                    {trait.name}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            color="primary"
            startIcon={
              loadingSchema ? <CircularProgress size={20} /> : <AddIcon />
            }
            onClick={handleAddTrait}
            disabled={!selectedTrait || loadingSchema || loadingTraits}
            style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            {loadingSchema ? 'Adding...' : 'Add Trait'}
          </Button>
        </Box>
      )}

      {/* Display Added Traits */}
      {addedTraits.length > 0 && (
        <Box mt={3}>
          <Typography variant="subtitle1" gutterBottom>
            Configured Traits ({addedTraits.length})
          </Typography>
          {addedTraits.map((trait, index) => (
            <Card
              key={trait.id}
              variant="outlined"
              style={{ marginBottom: 16 }}
            >
              <CardHeader
                title={trait.instanceName || `${trait.name} #${index + 1}`}
                action={
                  <IconButton
                    onClick={() => handleRemoveTrait(trait.id)}
                    size="small"
                  >
                    <DeleteIcon />
                  </IconButton>
                }
              />
              <CardContent>
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
                    children={<div />} // Hide submit button
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {rawErrors?.length ? (
        <FormHelperText error>{rawErrors.join(', ')}</FormHelperText>
      ) : null}
    </Box>
  );
};

/**
 * Validation function for traits
 * Validates trait configurations against their JSON schemas
 */
export const traitsFieldValidation = (value: AddedTrait[], validation: any) => {
  if (!value || value.length === 0) {
    // Traits are optional, no error if empty
    return;
  }

  // Track instance names for uniqueness validation
  const instanceNames = new Set<string>();

  // Validate each trait configuration
  value.forEach((trait, index) => {
    if (!trait.name) {
      validation.addError(`Trait #${index + 1}: Name is required`);
      return;
    }

    if (!trait.instanceName || trait.instanceName.trim() === '') {
      validation.addError(`Trait #${index + 1}: Instance name is required`);
      return;
    }

    // Check for duplicate instance names
    if (instanceNames.has(trait.instanceName)) {
      validation.addError(
        `Trait #${index + 1}: Instance name "${
          trait.instanceName
        }" is already used. Each trait instance must have a unique name.`,
      );
    } else {
      instanceNames.add(trait.instanceName);
    }

    if (!trait.config) {
      validation.addError(`Trait #${index + 1}: Configuration is required`);
      return;
    }

    // Validate against schema if available
    if (trait.schema) {
      const validationResult = validator.validateFormData(
        trait.config,
        trait.schema,
      );

      if (validationResult.errors && validationResult.errors.length > 0) {
        validationResult.errors.forEach((error: any) => {
          const fieldPath = error.property
            ? error.property.replace(/^\./, '')
            : 'field';
          validation.addError(
            `${trait.instanceName}: ${fieldPath} ${error.message}`,
          );
        });
      }
    }
  });
};
