import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
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
import { useTraitsStyles } from './styles';
import { ComponentTrait } from '../../api/OpenChoreoClientApi';
import { extractEntityMetadata } from '../../utils/entityUtils';
import { sanitizeLabel } from '@openchoreo/backstage-plugin-common';

interface EditTraitDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (trait: ComponentTrait) => void;
  trait: ComponentTrait | null;
  existingInstanceNames: string[];
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

export const EditTraitDialog: React.FC<EditTraitDialogProps> = ({
  open,
  onClose,
  onSave,
  trait,
  existingInstanceNames,
}) => {
  const classes = useTraitsStyles();
  const { entity } = useEntity();
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  const [instanceName, setInstanceName] = useState<string>('');
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [traitSchema, setTraitSchema] = useState<JSONSchema7 | null>(null);
  const [uiSchema, setUiSchema] = useState<any>({});

  const [loadingSchema, setLoadingSchema] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [instanceNameError, setInstanceNameError] = useState<string>('');
  const [formValid, setFormValid] = useState(false);
  const [formErrors, setFormErrors] = useState<any[]>([]);
  const [formTouched, setFormTouched] = useState(false);

  // Extract entity metadata
  const metadata = extractEntityMetadata(entity);

  // Initialize state when trait changes
  useEffect(() => {
    if (!trait || !open) {
      return;
    }

    setInstanceName(trait.instanceName);
    setParameters(trait.parameters || {});
    setFormTouched(false);
  }, [trait, open]);

  // Fetch schema when dialog opens
  useEffect(() => {
    if (!trait || !open) {
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
          )}&traitName=${encodeURIComponent(trait.name)}`,
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
  }, [trait, open, metadata.namespace, discoveryApi, fetchApi]);

  // Validate instance name
  useEffect(() => {
    if (!instanceName.trim()) {
      setInstanceNameError('Instance name is required');
    } else if (
      // Check if instance name exists (but exclude the current trait's original name)
      trait &&
      instanceName !== trait.instanceName &&
      existingInstanceNames.includes(instanceName)
    ) {
      setInstanceNameError(
        'Instance name already exists. Please choose a unique name.',
      );
    } else {
      setInstanceNameError('');
    }
  }, [instanceName, existingInstanceNames, trait]);

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

  const handleSave = () => {
    if (!trait || !instanceName.trim() || instanceNameError) {
      return;
    }

    const updatedTrait: ComponentTrait = {
      name: trait.name,
      instanceName: instanceName.trim(),
      parameters,
    };

    onSave(updatedTrait);
    handleClose();
  };

  const canSave =
    trait &&
    instanceName.trim() &&
    !instanceNameError &&
    !loadingSchema &&
    formValid &&
    formErrors.length === 0;

  if (!trait) {
    return null;
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Edit Trait: {trait.name}</DialogTitle>
      <DialogContent dividers className={classes.dialogContent}>
        {error && (
          <Typography variant="body2" color="error" gutterBottom>
            {error}
          </Typography>
        )}

        {/* Loading Schema */}
        {loadingSchema && (
          <Box display="flex" alignItems="center" mt={2}>
            <CircularProgress size={20} style={{ marginRight: 8 }} />
            <Typography variant="body2">Loading trait schema...</Typography>
          </Box>
        )}

        {/* Instance Name and Parameters */}
        {!loadingSchema && (
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
            {traitSchema && (
              <Box mt={2}>
                <Typography variant="subtitle2" gutterBottom>
                  Configuration:
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
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleSave}
          color="primary"
          variant="contained"
          disabled={!canSave}
        >
          Update Trait
        </Button>
      </DialogActions>
    </Dialog>
  );
};
