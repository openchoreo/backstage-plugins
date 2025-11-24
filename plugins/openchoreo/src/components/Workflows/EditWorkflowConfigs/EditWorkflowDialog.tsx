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
import CloseIcon from '@material-ui/icons/Close';
import Form from '@rjsf/material-ui';
import validator from '@rjsf/validator-ajv8';
import { RJSFValidationError } from '@rjsf/utils';
import { JSONSchema7 } from 'json-schema';
import {
  useApi,
  discoveryApiRef,
  identityApiRef,
} from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  fetchWorkflowSchema,
  updateComponentWorkflowSchema,
} from '../../../api/workflows';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useEditWorkflowStyles } from './styles';
import { ChangesPreview } from './ChangesPreview';
import { addTitlesToSchema, calculateChanges } from './utils';

interface EditWorkflowDialogProps {
  open: boolean;
  onClose: () => void;
  workflowName: string;
  currentWorkflowSchema: { [key: string]: unknown } | null;
  onSaved: () => void;
}

export const EditWorkflowDialog: React.FC<EditWorkflowDialogProps> = ({
  open,
  onClose,
  workflowName,
  currentWorkflowSchema,
  onSaved,
}) => {
  const classes = useEditWorkflowStyles();
  const { entity } = useEntity();
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

  const getChanges = () => calculateChanges(initialFormData, formData);

  const handleUpdateClick = () => {
    if (schema) {
      const validationResult = validator.validateFormData(formData, schema);
      if (validationResult.errors && validationResult.errors.length > 0) {
        setFormErrors(validationResult.errors);
        setError('Please fix the validation errors before updating');
        setTimeout(() => setError(null), 3000);
        return;
      }
    }

    const changes = getChanges();
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

  const handleClose = () => {
    setShowSaveConfirm(false);
    setError(null);
    setFormErrors([]);
    onClose();
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
    } finally {
      setSaving(false);
    }
  };

  const handleFormChange = (e: any) => {
    setFormData(e.formData);
    setFormErrors(e.errors || []);
  };

  const renderDialogContent = () => {
    if (showSaveConfirm) {
      return (
        <Box>
          <ChangesPreview changes={getChanges()} />
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
    const hasChanges = getChanges().length > 0;

    return (
      <Box display="flex" justifyContent="flex-end" width="100%">
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleUpdateClick}
          variant="contained"
          color="primary"
          disabled={saving || loading || hasValidationErrors || !hasChanges}
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
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="edit-workflow-dialog-title"
    >
      <DialogTitle id="edit-workflow-dialog-title">
        <Box className={classes.dialogTitle}>
          <Typography variant="h5">Edit Workflow - {workflowName}</Typography>
          <IconButton
            aria-label="close"
            onClick={handleClose}
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
