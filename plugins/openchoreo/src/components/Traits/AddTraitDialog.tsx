import { useState, useEffect, useMemo } from 'react';
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
import { useEntity } from '@backstage/plugin-catalog-react';
import Form from '@rjsf/material-ui';
import { JSONSchema7 } from 'json-schema';
import validator from '@rjsf/validator-ajv8';
import { TraitConfigToggle } from '@openchoreo/backstage-plugin-react';
import { useTraitsStyles } from './styles';
import { ComponentTrait } from '../../api/OpenChoreoClientApi';
import { ResponseError } from '@backstage/errors';
import { isForbiddenError, getErrorMessage } from '../../utils/errorUtils';
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
  allowedTraits?: Array<{ kind?: string; name: string }>;
}

type TraitKind = 'Trait' | 'ClusterTrait';

interface TraitListItem {
  name: string;
  createdAt: string;
  kind: TraitKind;
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

const buildTraitKey = (trait: TraitListItem): string =>
  `${trait.kind}:${trait.name}`;

const parseTraitKey = (
  key: string,
): { kind: TraitKind; name: string } | null => {
  if (!key) return null;
  const [kind, ...nameParts] = key.split(':');
  const name = nameParts.join(':');
  if (!name || (kind !== 'Trait' && kind !== 'ClusterTrait')) {
    return null;
  }
  return { kind, name };
};

export const AddTraitDialog: React.FC<AddTraitDialogProps> = ({
  open,
  onClose,
  onAdd,
  existingInstanceNames,
  allowedTraits: allowedTraitsProp,
}) => {
  const classes = useTraitsStyles();
  const { entity } = useEntity();
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  const componentTypeKind =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT_TYPE_KIND];
  const isClusterCT = componentTypeKind === 'ClusterComponentType';

  const [selectedTraitKey, setSelectedTraitKey] = useState<string>('');
  const [instanceName, setInstanceName] = useState<string>('');
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [traitSchema, setTraitSchema] = useState<JSONSchema7 | null>(null);
  const [uiSchema, setUiSchema] = useState<any>({});

  const [loadingSchema, setLoadingSchema] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [instanceNameError, setInstanceNameError] = useState<string>('');
  const [formValid, setFormValid] = useState(false);
  const [showFormErrors, setShowFormErrors] = useState(false);
  const [yamlValid, setYamlValid] = useState(true);

  // Extract entity metadata
  const metadata = extractEntityMetadata(entity);
  const selectedTraitMeta = parseTraitKey(selectedTraitKey);
  const selectedTraitName = selectedTraitMeta?.name ?? '';
  const selectedTraitKind =
    selectedTraitMeta?.kind ?? (isClusterCT ? 'ClusterTrait' : 'Trait');

  // Derive available traits directly from the allowedTraits prop
  const availableTraits: TraitListItem[] = useMemo(() => {
    if (!allowedTraitsProp || allowedTraitsProp.length === 0) return [];
    const defaultKind: TraitKind = isClusterCT ? 'ClusterTrait' : 'Trait';
    return allowedTraitsProp.map(at => ({
      name: at.name,
      createdAt: '',
      kind: (at.kind as TraitKind) ?? defaultKind,
    }));
  }, [allowedTraitsProp, isClusterCT]);

  // Fetch schema when trait is selected
  useEffect(() => {
    if (!selectedTraitKey) {
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

        const schemaUrl =
          selectedTraitKind === 'ClusterTrait'
            ? `${baseUrl}/cluster-trait-schema?clusterTraitName=${encodeURIComponent(
                selectedTraitName,
              )}`
            : `${baseUrl}/trait-schema?namespaceName=${encodeURIComponent(
                metadata.namespace,
              )}&traitName=${encodeURIComponent(selectedTraitName)}`;

        const response = await fetchApi.fetch(schemaUrl);

        if (!response.ok) {
          throw await ResponseError.fromResponse(response);
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
          setInstanceName(`${selectedTraitName}-1`);
        }
      } catch (err) {
        if (!ignore) {
          setTraitSchema(null);
          setUiSchema({});
          setParameters({});
          setInstanceName('');
          setShowFormErrors(false);
          if (isForbiddenError(err)) {
            setError(
              'You do not have permission to view this trait schema. Contact your administrator.',
            );
          } else {
            setError(`Failed to fetch trait schema: ${getErrorMessage(err)}`);
          }
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
  }, [
    selectedTraitKey,
    selectedTraitName,
    selectedTraitKind,
    metadata.namespace,
    discoveryApi,
    fetchApi,
  ]);

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
    setSelectedTraitKey('');
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
    if (!selectedTraitName || !instanceName.trim() || instanceNameError) {
      return;
    }

    const trait: ComponentTrait = {
      kind: selectedTraitKind,
      name: selectedTraitName,
      instanceName: instanceName.trim(),
      parameters,
    };

    onAdd(trait);
    handleClose();
  };

  const canAdd =
    selectedTraitKey &&
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
          <FormControl fullWidth variant="outlined">
            <InputLabel>Select a Trait</InputLabel>
            <Select
              label="Select a Trait"
              value={selectedTraitKey}
              onChange={e => setSelectedTraitKey(e.target.value as string)}
            >
              {availableTraits.length === 0 && (
                <MenuItem disabled>No traits available</MenuItem>
              )}
              {availableTraits.map(trait => (
                <MenuItem
                  key={buildTraitKey(trait)}
                  value={buildTraitKey(trait)}
                >
                  {trait.name}
                  {trait.kind === 'ClusterTrait' ? ' (Cluster)' : ''}
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
        {selectedTraitKey && !loadingSchema && traitSchema && (
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
