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

/**
 * Schema for the Addons Field
 */
export const AddonsFieldSchema = {
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

interface AddonListItem {
  name: string;
  createdAt: string;
}

export interface AddedAddon {
  id: string; // Unique ID for this instance (internal tracking)
  name: string; // Addon type name
  instanceName: string; // User-editable instance name
  config: Record<string, any>;
  schema?: JSONSchema7;
}

/**
 * AddonsField component
 * Allows users to add multiple addons with their configurations
 */
export const AddonsField = ({
  onChange,
  rawErrors,
  formData,
  uiSchema,
}: FieldExtensionComponentProps<AddedAddon[]>) => {
  const [availableAddons, setAvailableAddons] = useState<AddonListItem[]>([]);
  const [addedAddons, setAddedAddons] = useState<AddedAddon[]>(formData || []);
  const [selectedAddon, setSelectedAddon] = useState<string>('');
  const [loadingAddons, setLoadingAddons] = useState(false);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);

  // Get organization name from ui:options
  const organizationName =
    typeof uiSchema?.['ui:options']?.organizationName === 'string'
      ? uiSchema['ui:options'].organizationName
      : '';

  // Fetch available addons on mount
  useEffect(() => {
    let ignore = false;

    const fetchAddons = async () => {
      if (!organizationName) {
        return;
      }

      setLoadingAddons(true);
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
          `${baseUrl}/addons?organizationName=${encodeURIComponent(orgName)}&page=1&pageSize=100`,
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
          setAvailableAddons(result.data.items);
        }
      } catch (err) {
        if (!ignore) {
          setError(`Failed to fetch addons: ${err}`);
        }
      } finally {
        if (!ignore) {
          setLoadingAddons(false);
        }
      }
    };

    fetchAddons();

    return () => {
      ignore = true;
    };
  }, [organizationName, discoveryApi, identityApi]);

  // Fetch schema for selected addon and add it
  const handleAddAddon = async () => {
    if (!selectedAddon || !organizationName) {
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
        `${baseUrl}/addon-schema?organizationName=${encodeURIComponent(orgName)}&addonName=${encodeURIComponent(selectedAddon)}`,
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
        const newAddon: AddedAddon = {
          id: `${selectedAddon}-${Date.now()}`, // Unique ID for this instance
          name: selectedAddon,
          instanceName: `${selectedAddon}-${addedAddons.length + 1}`, // Default instance name
          config: {},
          schema: result.data,
        };

        const updatedAddons = [...addedAddons, newAddon];
        setAddedAddons(updatedAddons);
        onChange(updatedAddons);
        setSelectedAddon(''); // Reset selection
      }
    } catch (err) {
      setError(`Failed to fetch addon schema: ${err}`);
    } finally {
      setLoadingSchema(false);
    }
  };

  // Remove an addon
  const handleRemoveAddon = (id: string) => {
    const updatedAddons = addedAddons.filter(addon => addon.id !== id);
    setAddedAddons(updatedAddons);
    onChange(updatedAddons);
  };

  // Update addon instance name
  const handleInstanceNameChange = (id: string, instanceName: string) => {
    const updatedAddons = addedAddons.map(addon =>
      addon.id === id ? { ...addon, instanceName } : addon,
    );
    setAddedAddons(updatedAddons);
    onChange(updatedAddons);
  };

  // Update addon configuration
  const handleAddonConfigChange = (id: string, config: Record<string, any>) => {
    const updatedAddons = addedAddons.map(addon =>
      addon.id === id ? { ...addon, config } : addon,
    );
    setAddedAddons(updatedAddons);
    onChange(updatedAddons);
  };

  return (
    <Box mt={2} mb={2}>
      <Typography variant="h6" gutterBottom>
        Addons
      </Typography>
      <Typography variant="body2" color="textSecondary" gutterBottom>
        Add optional addons to enhance your component functionality. You can add multiple addons.
      </Typography>

      {error && (
        <Typography variant="body2" color="error" gutterBottom>
          {error}
        </Typography>
      )}

      {/* Addon Selection */}
      <Box display="flex" alignItems="center" mt={2} mb={3}>
        <FormControl fullWidth disabled={loadingAddons || loadingSchema} style={{ marginRight: 16 }}>
          <InputLabel>Select an Addon</InputLabel>
          <Select
            value={selectedAddon}
            onChange={e => setSelectedAddon(e.target.value as string)}
          >
            {loadingAddons && (
              <MenuItem disabled>
                <CircularProgress size={20} style={{ marginRight: 8 }} />
                Loading addons...
              </MenuItem>
            )}
            {!loadingAddons && availableAddons.length === 0 && (
              <MenuItem disabled>
                {organizationName
                  ? 'No addons available'
                  : 'Select an organization first'}
              </MenuItem>
            )}
            {!loadingAddons &&
              availableAddons.map(addon => (
                <MenuItem key={addon.name} value={addon.name}>
                  {addon.name}
                </MenuItem>
              ))}
          </Select>
        </FormControl>
        <Button
          variant="outlined"
          color="primary"
          startIcon={loadingSchema ? <CircularProgress size={20} /> : <AddIcon />}
          onClick={handleAddAddon}
          disabled={!selectedAddon || loadingSchema || loadingAddons}
          style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          {loadingSchema ? 'Adding...' : 'Add Addon'}
        </Button>
      </Box>

      {/* Display Added Addons */}
      {addedAddons.length > 0 && (
        <Box mt={3}>
          <Typography variant="subtitle1" gutterBottom>
            Configured Addons ({addedAddons.length})
          </Typography>
          {addedAddons.map((addon, index) => (
            <Card key={addon.id} variant="outlined" style={{ marginBottom: 16 }}>
              <CardHeader
                title={addon.instanceName || `${addon.name} #${index + 1}`}
                action={
                  <IconButton
                    onClick={() => handleRemoveAddon(addon.id)}
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
                    value={addon.instanceName || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleInstanceNameChange(addon.id, e.target.value)
                    }
                    fullWidth
                    required
                    helperText="A unique name to identify this addon instance"
                  />
                </Box>

                {/* Addon Configuration */}
                {addon.schema && (
                  <Form
                    schema={addon.schema}
                    formData={addon.config}
                    onChange={data => handleAddonConfigChange(addon.id, data.formData)}
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
 * Validation function for addons
 */
export const addonsFieldValidation = (
  value: AddedAddon[],
  validation: any,
) => {
  if (!value || value.length === 0) {
    // Addons are optional, no error if empty
    return;
  }

  // Track instance names for uniqueness validation
  const instanceNames = new Set<string>();

  // Validate each addon configuration
  value.forEach((addon, index) => {
    if (!addon.name) {
      validation.addError(`Addon #${index + 1}: Name is required`);
      return;
    }

    if (!addon.instanceName || addon.instanceName.trim() === '') {
      validation.addError(`Addon #${index + 1}: Instance name is required`);
      return;
    }

    // Check for duplicate instance names
    if (instanceNames.has(addon.instanceName)) {
      validation.addError(
        `Addon #${index + 1}: Instance name "${addon.instanceName}" is already used. Each addon instance must have a unique name.`,
      );
    } else {
      instanceNames.add(addon.instanceName);
    }

    if (!addon.config) {
      validation.addError(`Addon #${index + 1}: Configuration is required`);
      return;
    }

    // Validate against schema if available
    if (addon.schema) {
      const validationResult = validator.validateFormData(
        addon.config,
        addon.schema,
      );

      if (validationResult.errors && validationResult.errors.length > 0) {
        validationResult.errors.forEach((error: any) => {
          const fieldPath = error.property ? error.property.replace(/^\./, '') : 'field';
          validation.addError(
            `${addon.instanceName}: ${fieldPath} ${error.message}`,
          );
        });
      }
    }
  });
};
