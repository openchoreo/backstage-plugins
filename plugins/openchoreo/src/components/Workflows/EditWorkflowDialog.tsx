import { useEffect, useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Box,
  Typography,
  CircularProgress,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import CloseIcon from '@material-ui/icons/Close';
import Form from '@rjsf/material-ui';
import validator from '@rjsf/validator-ajv8';
import { RJSFValidationError } from '@rjsf/utils';
import { JSONSchema7 } from 'json-schema';
import { Entity } from '@backstage/catalog-model';
import {
  useApi,
  discoveryApiRef,
  identityApiRef,
} from '@backstage/core-plugin-api';
import {
  fetchWorkflowSchema,
  updateComponentWorkflowSchema,
} from '../../api/workflows';
import {
  CHOREO_ANNOTATIONS,
  sanitizeLabel,
} from '@openchoreo/backstage-plugin-common';

/**
 * Recursively adds title fields to schema properties if not already defined.
 * Honors existing title fields, otherwise generates from property key.
 */
function addTitlesToSchema(schema: JSONSchema7): JSONSchema7 {
  if (!schema || typeof schema !== 'object') return schema;

  const result = { ...schema };

  if (result.properties) {
    const newProperties: { [key: string]: JSONSchema7 | boolean } = {};
    for (const [key, value] of Object.entries(result.properties)) {
      if (typeof value === 'boolean') {
        newProperties[key] = value;
      } else if (typeof value === 'object' && value !== null) {
        const prop = { ...value } as JSONSchema7;
        if (!prop.title) {
          prop.title = sanitizeLabel(key);
        }
        newProperties[key] = addTitlesToSchema(prop);
      }
    }
    result.properties = newProperties;
  }

  if (result.items && typeof result.items === 'object' && !Array.isArray(result.items)) {
    result.items = addTitlesToSchema(result.items as JSONSchema7);
  }

  return result;
}

const useStyles = makeStyles(theme => ({
  dialogTitle: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: theme.spacing(1),
  },
  closeButton: {
    marginLeft: theme.spacing(2),
  },
  dialogContent: {
    minHeight: '400px',
    paddingTop: theme.spacing(2),
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(4),
    gap: theme.spacing(2),
    minHeight: '400px',
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
    gap: theme.spacing(2),
  },
  helpText: {
    padding: theme.spacing(2),
    backgroundColor: theme.palette.background.default,
    borderRadius: theme.shape.borderRadius,
    marginBottom: theme.spacing(2),
  },
  changesPreview: {
    backgroundColor: '#f5f5f5',
    borderRadius: '4px',
    maxHeight: '300px',
    overflow: 'auto',
    padding: theme.spacing(2),
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
}));

interface EditWorkflowDialogProps {
  open: boolean;
  onClose: () => void;
  entity: Entity;
  workflowName: string;
  currentWorkflowSchema: { [key: string]: unknown } | null;
  onSaved: () => void;
}

export const EditWorkflowDialog: React.FC<EditWorkflowDialogProps> = ({
  open,
  onClose,
  entity,
  workflowName,
  currentWorkflowSchema,
  onSaved,
}) => {
  const classes = useStyles();
  const discovery = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schema, setSchema] = useState<JSONSchema7 | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [initialFormData, setInitialFormData] = useState<any>({});
  const [formErrors, setFormErrors] = useState<RJSFValidationError[]>([]);

  const loadWorkflowSchema = useCallback(async () => {
    if (!workflowName) {
      setError('No workflow name provided');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const organization =
        entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION];

      if (!organization) {
        throw new Error('Organization not found in entity');
      }

      // Fetch the workflow schema (defines the structure of the form)
      const schemaResponse = await fetchWorkflowSchema(
        discovery,
        identityApi,
        organization,
        workflowName,
      );

      if (schemaResponse.success && schemaResponse.data) {
        const rawSchema = schemaResponse.data as JSONSchema7;
        setSchema(addTitlesToSchema(rawSchema));
      } else {
        throw new Error('Failed to fetch workflow schema');
      }

      // Set the current values from the component's workflow schema
      if (currentWorkflowSchema) {
        setFormData(currentWorkflowSchema);
        setInitialFormData(currentWorkflowSchema);
      } else {
        setFormData({});
        setInitialFormData({});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [entity, discovery, identityApi, workflowName, currentWorkflowSchema]);

  useEffect(() => {
    if (open && workflowName) {
      loadWorkflowSchema();
    }
  }, [open, workflowName, loadWorkflowSchema]);

  const calculateChanges = () => {
    const changes: Array<{
      path: string;
      type: 'new' | 'modified' | 'removed';
      oldValue?: any;
      newValue?: any;
    }> = [];

    const traverse = (obj1: any, obj2: any, path: string = '') => {
      const allKeys = new Set([
        ...Object.keys(obj1 || {}),
        ...Object.keys(obj2 || {}),
      ]);

      allKeys.forEach(key => {
        const currentPath = path ? `${path}.${key}` : key;
        const val1 = obj1?.[key];
        const val2 = obj2?.[key];

        if (val1 === undefined && val2 !== undefined) {
          changes.push({
            path: currentPath,
            type: 'new',
            newValue: val2,
          });
        } else if (val1 !== undefined && val2 === undefined) {
          changes.push({
            path: currentPath,
            type: 'removed',
            oldValue: val1,
          });
        } else if (
          typeof val1 === 'object' &&
          val1 !== null &&
          typeof val2 === 'object' &&
          val2 !== null &&
          !Array.isArray(val1) &&
          !Array.isArray(val2)
        ) {
          traverse(val1, val2, currentPath);
        } else if (JSON.stringify(val1) !== JSON.stringify(val2)) {
          changes.push({
            path: currentPath,
            type: 'modified',
            oldValue: val1,
            newValue: val2,
          });
        }
      });
    };

    traverse(initialFormData, formData);
    return changes;
  };

  const handleUpdateClick = () => {
    // Validate form before proceeding
    if (schema) {
      const validationResult = validator.validateFormData(formData, schema);
      if (validationResult.errors && validationResult.errors.length > 0) {
        setFormErrors(validationResult.errors);
        setError('Please fix the validation errors before updating');
        setTimeout(() => setError(null), 3000);
        return;
      }
    }

    const changes = calculateChanges();
    if (changes.length === 0) {
      setError('No changes to save');
      setTimeout(() => setError(null), 3000);
      return;
    }
    setShowSaveConfirm(true);
  };

  const handleCancelSave = () => {
    setShowSaveConfirm(false);
    setError(null);
  };

  const handleConfirmSave = async () => {
    setSaving(true);
    setError(null);

    try {
      await updateComponentWorkflowSchema(
        entity,
        discovery,
        identityApi,
        formData,
      );

      setShowSaveConfirm(false);
      onSaved();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update workflow schema',
      );
      // Stay on confirmation screen to show error
    } finally {
      setSaving(false);
    }
  };

  const handleFormChange = (e: any) => {
    setFormData(e.formData);
    setFormErrors(e.errors || []);
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const renderChangesPreview = () => {
    const changes = calculateChanges();

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Confirm Changes ({changes.length}{' '}
          {changes.length === 1 ? 'change' : 'changes'})
        </Typography>
        <Box className={classes.changesPreview}>
          {changes.map((change, index) => (
            <Box
              key={index}
              mb={index < changes.length - 1 ? 1.5 : 0}
              style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
            >
              {change.type === 'new' && (
                <Typography style={{ color: '#2e7d32' }}>
                  <strong>{change.path}:</strong>{' '}
                  <span style={{ color: '#666' }}>[New]</span>{' '}
                  {formatValue(change.newValue)}
                </Typography>
              )}
              {change.type === 'modified' && (
                <Typography style={{ color: '#ed6c02' }}>
                  <strong>{change.path}:</strong> {formatValue(change.oldValue)}{' '}
                  → {formatValue(change.newValue)}
                </Typography>
              )}
              {change.type === 'removed' && (
                <Typography style={{ color: '#d32f2f' }}>
                  <strong>{change.path}:</strong>{' '}
                  <span style={{ color: '#666' }}>[Removed]</span>{' '}
                  {formatValue(change.oldValue)}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
        <Typography variant="body2" color="textSecondary">
          This will update the workflow configuration for the component.
        </Typography>
      </Box>
    );
  };

  const renderDialogContent = () => {
    if (showSaveConfirm) {
      return (
        <Box>
          {renderChangesPreview()}
          {error && (
            <Box mt={2} p={2} bgcolor="error.light" borderRadius={1}>
              <Typography color="error" variant="body2">
                <strong>Error:</strong> {error}
              </Typography>
            </Box>
          )}
        </Box>
      );
    }

    return (
      <>
        {loading && (
          <Box className={classes.loadingContainer}>
            <CircularProgress />
            <Typography variant="body2" color="textSecondary">
              Loading workflow schema...
            </Typography>
          </Box>
        )}

        {error && !loading && (
          <Box className={classes.errorContainer}>
            <Typography color="error">{error}</Typography>
            <Button onClick={loadWorkflowSchema} variant="outlined">
              Retry
            </Button>
          </Box>
        )}

        {!loading && !error && schema && (
          <>
            <Box className={classes.helpText}>
              <Typography variant="body2" gutterBottom>
                <strong>Workflow Configuration</strong>
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Edit the workflow configuration for this component. Changes will
                be applied after you click Update.
              </Typography>
            </Box>

            <Form
              schema={schema}
              formData={formData}
              onChange={handleFormChange}
              validator={validator}
              liveValidate
              showErrorList={false}
              noHtml5Validate
            >
              <div />
            </Form>
          </>
        )}
      </>
    );
  };

  const renderDialogActions = () => {
    if (showSaveConfirm) {
      return (
        <Box display="flex" justifyContent="flex-end" width="100%">
          <Button onClick={handleCancelSave} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmSave}
            color="primary"
            variant="contained"
            disabled={saving}
            style={{ marginLeft: 8 }}
          >
            {saving ? 'Updating...' : 'Confirm Update'}
          </Button>
        </Box>
      );
    }

    const hasValidationErrors = formErrors.length > 0;

    return (
      <Box display="flex" justifyContent="flex-end" width="100%">
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleUpdateClick}
          variant="contained"
          color="primary"
          disabled={saving || loading || hasValidationErrors}
          style={{ marginLeft: 8 }}
        >
          Update
        </Button>
      </Box>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="edit-workflow-dialog-title"
    >
      <DialogTitle id="edit-workflow-dialog-title">
        <Box className={classes.dialogTitle}>
          <Typography variant="h5">Edit Workflow - {workflowName}</Typography>
          <IconButton
            aria-label="close"
            onClick={onClose}
            className={classes.closeButton}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers className={classes.dialogContent}>
        {renderDialogContent()}
      </DialogContent>
      <DialogActions>{renderDialogActions()}</DialogActions>
    </Dialog>
  );
};
