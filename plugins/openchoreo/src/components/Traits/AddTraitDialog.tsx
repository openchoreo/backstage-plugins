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
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { useEntity, catalogApiRef } from '@backstage/plugin-catalog-react';
import Form from '@rjsf/material-ui';
import { JSONSchema7 } from 'json-schema';
import validator from '@rjsf/validator-ajv8';
import { TraitConfigToggle } from '@openchoreo/backstage-plugin-react';
import { useTraitsStyles } from './styles';
import { ComponentTrait } from '../../api/OpenChoreoClientApi';
import { extractEntityMetadata } from '../../utils/entityUtils';
import {
  sanitizeLabel,
  CHOREO_ANNOTATIONS,
} from '@openchoreo/backstage-plugin-common';

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
 * Checks whether any required field defined in the schema is missing or
 * effectively empty in the given data.  JSON Schema `required` only checks
 * key presence, so `{ name: '' }` passes ajv validation even though the
 * user hasn't provided a meaningful value.  This helper fills that gap.
 */
function hasEmptyRequiredFields(
  schema: JSONSchema7,
  data: Record<string, any>,
): boolean {
  if (!schema.required || !schema.properties) return false;

  for (const field of schema.required) {
    const value = data[field];
    if (value === undefined || value === null) return true;

    const propSchema = schema.properties[field];
    if (
      typeof propSchema === 'object' &&
      propSchema.type === 'string' &&
      value === ''
    ) {
      return true;
    }
  }
  return false;
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
  const fetchApi = useApi(fetchApiRef);
  const catalogApi = useApi(catalogApiRef);

  const componentTypeName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT_TYPE];

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
  const [showFormErrors, setShowFormErrors] = useState(false);
  const [yamlValid, setYamlValid] = useState(true);

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
        const baseUrl = await discoveryApi.getBaseUrl('openchoreo');

        const response = await fetchApi.fetch(
          `${baseUrl}/traits?namespaceName=${encodeURIComponent(
            metadata.namespace,
          )}&page=1&pageSize=100`,
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (!ignore && result.success) {
          let items: TraitListItem[] = result.data.items || [];

          // Filter by component type's allowedTraits if available
          if (componentTypeName) {
            try {
              const ctEntities = await catalogApi.getEntities({
                filter: { kind: 'ComponentType' },
              });
              // componentTypeName is in format 'workloadType/name' (e.g. 'deployment/service'),
              // but entity metadata.name is just the name part (e.g. 'service')
              // console.log('ctName', ctName);
              const matchingCt = ctEntities.items.find(
                e =>
                  `${e.spec?.workloadType}/${e.metadata.name}` ===
                  componentTypeName,
              );
              const allowedTraits = (matchingCt?.spec as any)?.allowedTraits as
                | string[]
                | undefined;
              if (allowedTraits && allowedTraits.length > 0) {
                items = items.filter(t => allowedTraits.includes(t.name));
              }
            } catch {
              // If fetching component types fails, show all traits
            }
          }

          setAvailableTraits(items);
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
  }, [
    open,
    metadata.namespace,
    discoveryApi,
    fetchApi,
    catalogApi,
    componentTypeName,
  ]);

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
        const baseUrl = await discoveryApi.getBaseUrl('openchoreo');

        const response = await fetchApi.fetch(
          `${baseUrl}/trait-schema?namespaceName=${encodeURIComponent(
            metadata.namespace,
          )}&traitName=${encodeURIComponent(selectedTrait)}`,
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
          setShowFormErrors(false);
          setYamlValid(true);
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
  }, [selectedTrait, metadata.namespace, discoveryApi, fetchApi]);

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

    try {
      const result = validator.validateFormData(parameters, traitSchema);
      const hasSchemaErrors = result.errors.length > 0;
      const hasEmptyRequired = hasEmptyRequiredFields(traitSchema, parameters);
      setFormValid(!hasSchemaErrors && !hasEmptyRequired);
    } catch (err) {
      setFormValid(false);
    }
  }, [parameters, traitSchema]);

  const handleClose = () => {
    // Reset state
    setSelectedTrait('');
    setInstanceName('');
    setParameters({});
    setTraitSchema(null);
    setUiSchema({});
    setError(null);
    setInstanceNameError('');
    setFormValid(false);
    setShowFormErrors(false);
    setYamlValid(true);
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
    yamlValid;

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
              <TraitConfigToggle
                schema={traitSchema}
                formData={parameters}
                onChange={setParameters}
                onValidityChange={setYamlValid}
              >
                <Form
                  schema={traitSchema}
                  uiSchema={uiSchema}
                  formData={parameters}
                  onChange={data => {
                    setShowFormErrors(true);
                    setParameters(data.formData);
                  }}
                  validator={validator}
                  liveValidate={showFormErrors}
                  showErrorList={false}
                  noHtml5Validate
                  omitExtraData
                  tagName="div"
                  children={<div />}
                />
              </TraitConfigToggle>
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
