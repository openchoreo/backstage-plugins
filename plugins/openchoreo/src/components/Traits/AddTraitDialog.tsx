import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Box,
  Typography,
} from '@material-ui/core';
import {
  useApi,
  discoveryApiRef,
  identityApiRef,
} from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import Form from '@rjsf/material-ui';
import { JSONSchema7 } from 'json-schema';
import validator from '@rjsf/validator-ajv8';
import { useTraitsStyles } from './styles';
import { ComponentTrait } from '../../api/traits';
import { extractEntityMetadata } from '../../utils/entityUtils';
import { sanitizeLabel } from '@openchoreo/backstage-plugin-common';

interface AddTraitDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (trait: ComponentTrait) => void;
  existingInstanceNames: string[];
}

interface TraitListItem {
  name: string;
  createdAt: string;
}

/**
 * Recursively generates a UI Schema with sanitized titles for all fields
 * that don't already have a title in the JSON Schema.
 */
function generateUiSchemaWithTitles(
  schema: any,
  hideErrors: boolean = false,
): any {
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

        // If the property doesn't have a title, add one in the UI schema
        const fieldUiSchema: any = {};

        if (!propSchema.title) {
          fieldUiSchema['ui:title'] = sanitizeLabel(key);
        }

        // Hide errors if requested
        if (hideErrors) {
          fieldUiSchema['ui:options'] = {
            ...fieldUiSchema['ui:options'],
            hideError: true,
          };
        }

        uiSchema[key] = fieldUiSchema;

        // Recursively handle nested objects
        if (propSchema.type === 'object' && propSchema.properties) {
          const nestedUiSchema = generateUiSchemaWithTitles(
            propSchema,
            hideErrors,
          );
          uiSchema[key] = {
            ...uiSchema[key],
            ...nestedUiSchema,
          };
        }

        // Handle array items
        if (propSchema.type === 'array' && propSchema.items) {
          const itemsUiSchema = generateUiSchemaWithTitles(
            propSchema.items,
            hideErrors,
          );
          if (Object.keys(itemsUiSchema).length > 0) {
            uiSchema[key] = {
              ...uiSchema[key],
              items: itemsUiSchema,
            };
          }
        }
      },
    );
  }

  return uiSchema;
}

export const AddTraitDialog: React.FC<AddTraitDialogProps> = ({
  open,
  onClose,
  onAdd,
  existingInstanceNames,
}) => {
  const classes = useTraitsStyles();
  const { entity } = useEntity();
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);

  const [availableTraits, setAvailableTraits] = useState<TraitListItem[]>([]);
  const [selectedTrait, setSelectedTrait] = useState<string>('');
  const [instanceName, setInstanceName] = useState<string>('');
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [traitSchema, setTraitSchema] = useState<JSONSchema7 | null>(null);
  const [uiSchema, setUiSchema] = useState<any>({});

  const [loadingTraits, setLoadingTraits] = useState(false);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [instanceNameError, setInstanceNameError] = useState<string>('');
  const [formValid, setFormValid] = useState(false);
  const [formErrors, setFormErrors] = useState<any[]>([]);
  const [formTouched, setFormTouched] = useState(false);

  // Extract entity metadata
  const metadata = extractEntityMetadata(entity);

  // Fetch available traits on mount
  useEffect(() => {
    if (!open) return undefined;

    let ignore = false;

    const fetchTraits = async () => {
      setLoadingTraits(true);
      setError(null);

      try {
        const { token } = await identityApi.getCredentials();
        const baseUrl = await discoveryApi.getBaseUrl('openchoreo');

        const response = await fetch(
          `${baseUrl}/traits?organizationName=${encodeURIComponent(
            metadata.organization,
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
          setAvailableTraits(result.data.items || []);
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
  }, [open, metadata.organization, discoveryApi, identityApi]);

  // Fetch schema when trait is selected
  useEffect(() => {
    if (!selectedTrait) {
      setTraitSchema(null);
      setUiSchema({});
      setParameters({});
      setInstanceName('');
      return undefined;
    }

    let ignore = false;

    const fetchSchema = async () => {
      setLoadingSchema(true);
      setError(null);

      try {
        const { token } = await identityApi.getCredentials();
        const baseUrl = await discoveryApi.getBaseUrl('openchoreo');

        const response = await fetch(
          `${baseUrl}/trait-schema?organizationName=${encodeURIComponent(
            metadata.organization,
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

        if (!ignore && result.success) {
          const schema = result.data;
          const generatedUiSchema = generateUiSchemaWithTitles(schema);

          setTraitSchema(schema);
          setUiSchema(generatedUiSchema);
          setParameters({});
          setFormErrors([]);
          setFormTouched(false);
          // Set default instance name
          setInstanceName(`${selectedTrait}-1`);
        }
      } catch (err) {
        if (!ignore) {
          setError(`Failed to fetch trait schema: ${err}`);
        }
      } finally {
        if (!ignore) {
          setLoadingSchema(false);
        }
      }
    };

    fetchSchema();

    return () => {
      ignore = true;
    };
  }, [selectedTrait, metadata.organization, discoveryApi, identityApi]);

  // Validate instance name
  useEffect(() => {
    if (!instanceName.trim()) {
      setInstanceNameError('Instance name is required');
    } else if (existingInstanceNames.includes(instanceName)) {
      setInstanceNameError(
        'Instance name already exists. Please choose a unique name.',
      );
    } else {
      setInstanceNameError('');
    }
  }, [instanceName, existingInstanceNames]);

  // Validate form data against schema
  useEffect(() => {
    if (!traitSchema) {
      setFormValid(true);
      return;
    }

    // Only validate if form has been touched or if no schema validation is required
    if (!formTouched) {
      // Check if schema has required fields, if not, form is valid
      const hasRequiredFields =
        traitSchema.required && traitSchema.required.length > 0;
      setFormValid(!hasRequiredFields);
      return;
    }

    try {
      const result = validator.validateFormData(parameters, traitSchema);
      setFormValid(result.errors.length === 0);
    } catch (err) {
      setFormValid(false);
    }
  }, [parameters, traitSchema, formTouched]);

  const handleClose = () => {
    // Reset state
    setSelectedTrait('');
    setInstanceName('');
    setParameters({});
    setTraitSchema(null);
    setUiSchema({});
    setError(null);
    setInstanceNameError('');
    setFormErrors([]);
    setFormValid(false);
    setFormTouched(false);
    onClose();
  };

  const handleAdd = () => {
    if (!selectedTrait || !instanceName.trim() || instanceNameError) {
      return;
    }

    const trait: ComponentTrait = {
      name: selectedTrait,
      instanceName: instanceName.trim(),
      parameters,
    };

    onAdd(trait);
    handleClose();
  };

  const canAdd =
    selectedTrait &&
    instanceName.trim() &&
    !instanceNameError &&
    !loadingSchema &&
    formValid &&
    formErrors.length === 0;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Typography variant="h4">Add Trait</Typography>
      </DialogTitle>
      <DialogContent dividers className={classes.dialogContent}>
        {error && (
          <Typography variant="body2" color="error" gutterBottom>
            {error}
          </Typography>
        )}

        {/* Trait Selection */}
        <Box className={classes.dialogField}>
          <FormControl fullWidth variant="outlined" disabled={loadingTraits}>
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
                <MenuItem disabled>No traits available</MenuItem>
              )}
              {!loadingTraits &&
                availableTraits.map(trait => (
                  <MenuItem key={trait.name} value={trait.name}>
                    {trait.name}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        </Box>

        {/* Loading Schema */}
        {loadingSchema && (
          <Box display="flex" alignItems="center" mt={2}>
            <CircularProgress size={20} style={{ marginRight: 8 }} />
            <Typography variant="body2">Loading trait schema...</Typography>
          </Box>
        )}

        {/* Instance Name and Parameters */}
        {selectedTrait && !loadingSchema && traitSchema && (
          <>
            <Box className={classes.dialogField}>
              <TextField
                label="Instance Name"
                value={instanceName}
                onChange={e => setInstanceName(e.target.value)}
                fullWidth
                required
                error={!!instanceNameError}
                helperText={
                  instanceNameError ||
                  'A unique name to identify this trait instance'
                }
              />
            </Box>

            {/* Trait Configuration Form */}
            <Box mt={2}>
              <Typography variant="subtitle2" gutterBottom>
                Parameters
              </Typography>
              <Form
                schema={traitSchema}
                uiSchema={uiSchema}
                formData={parameters}
                onChange={data => {
                  setFormTouched(true);
                  setParameters(data.formData);
                }}
                onBlur={() => {
                  // Trigger validation on blur
                  if (traitSchema) {
                    try {
                      const result = validator.validateFormData(
                        parameters,
                        traitSchema,
                      );
                      setFormErrors(result.errors || []);
                    } catch (err) {
                      // Validation error
                    }
                  }
                }}
                validator={validator}
                showErrorList={false}
                noHtml5Validate
                omitExtraData
                tagName="div"
                children={<div />} // Hide submit button
              />
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleAdd}
          color="primary"
          variant="contained"
          disabled={!canAdd}
        >
          Add Trait
        </Button>
      </DialogActions>
    </Dialog>
  );
};
