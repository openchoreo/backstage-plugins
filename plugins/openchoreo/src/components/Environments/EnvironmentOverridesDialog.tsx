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
import { JSONSchema7 } from 'json-schema';
import { Entity } from '@backstage/catalog-model';
import {
  useApi,
  discoveryApiRef,
  identityApiRef,
} from '@backstage/core-plugin-api';
import {
  fetchComponentReleaseSchema,
  fetchReleaseBindings,
  patchReleaseBindingOverrides,
} from '../../api/environments';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles(theme => ({
  dialogContent: {
    minHeight: '400px',
    paddingTop: theme.spacing(2),
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
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
}));

interface Environment {
  name: string;
  bindingName?: string;
  deployment: {
    status: 'success' | 'failed' | 'pending' | 'not-deployed' | 'suspended';
    lastDeployed?: string;
    image?: string;
    statusMessage?: string;
    releaseName?: string;
  };
}

interface EnvironmentOverridesDialogProps {
  open: boolean;
  onClose: () => void;
  environment: Environment | null;
  entity: Entity;
  onSaved: () => void;
}

interface ReleaseBinding {
  name: string;
  environment: string;
  componentTypeEnvOverrides?: any;
  workloadOverrides?: any;
}

export const EnvironmentOverridesDialog: React.FC<
  EnvironmentOverridesDialogProps
> = ({ open, onClose, environment, entity, onSaved }) => {
  const classes = useStyles();
  const discovery = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schema, setSchema] = useState<JSONSchema7 | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [initialFormData, setInitialFormData] = useState<any>({});

  const loadSchemaAndBinding = useCallback(async () => {
    if (!environment?.deployment.releaseName) {
      setError('No release deployed to this environment');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch schema for the release
      const schemaResponse = await fetchComponentReleaseSchema(
        entity,
        discovery,
        identityApi,
        environment.deployment.releaseName,
      );

      if (schemaResponse.success && schemaResponse.data) {
        // Extract the componentTypeEnvOverrides schema from the response
        const fullSchema = schemaResponse.data as any;
        const componentTypeSchema =
          fullSchema.properties?.componentTypeEnvOverrides;

        if (componentTypeSchema) {
          setSchema(componentTypeSchema as JSONSchema7);
        } else {
          throw new Error(
            'componentTypeEnvOverrides schema not found in response',
          );
        }
      } else {
        throw new Error('Failed to fetch schema');
      }

      // Fetch existing bindings to get current overrides
      const bindingsResponse = await fetchReleaseBindings(
        entity,
        discovery,
        identityApi,
      );

      if (bindingsResponse.success && bindingsResponse.data?.items) {
        const bindings = bindingsResponse.data.items as ReleaseBinding[];
        const currentBinding = bindings.find(
          b => b.environment.toLowerCase() === environment.name.toLowerCase(),
        );

        if (currentBinding?.componentTypeEnvOverrides) {
          setFormData(currentBinding.componentTypeEnvOverrides);
          setInitialFormData(currentBinding.componentTypeEnvOverrides);
        } else {
          setFormData({});
          setInitialFormData({});
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [entity, discovery, identityApi, environment]);

  useEffect(() => {
    if (open && environment) {
      loadSchemaAndBinding();
    }
  }, [open, environment, loadSchemaAndBinding]);

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
          // New field
          changes.push({
            path: currentPath,
            type: 'new',
            newValue: val2,
          });
        } else if (val1 !== undefined && val2 === undefined) {
          // Removed field
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
          // Recurse for nested objects
          traverse(val1, val2, currentPath);
        } else if (JSON.stringify(val1) !== JSON.stringify(val2)) {
          // Modified field
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

  const handleSaveClick = () => {
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
  };

  const handleConfirmSave = async () => {
    if (!environment) return;

    setSaving(true);
    setError(null);

    try {
      await patchReleaseBindingOverrides(
        entity,
        discovery,
        identityApi,
        environment.name.toLowerCase(),
        formData,
      );

      // Overrides saved successfully, backend will automatically redeploy
      setShowSaveConfirm(false);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save overrides');
      setShowSaveConfirm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const handleConfirmDelete = async () => {
    if (!environment) return;

    setDeleting(true);
    setError(null);

    try {
      // Patch with empty overrides to delete them
      await patchReleaseBindingOverrides(
        entity,
        discovery,
        identityApi,
        environment.name.toLowerCase(),
        {},
      );

      // Overrides deleted successfully, backend will automatically redeploy
      setShowDeleteConfirm(false);
      onSaved();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to delete overrides',
      );
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleFormChange = (e: any) => {
    setFormData(e.formData);
  };

  const hasOverrides = formData && Object.keys(formData).length > 0;
  const hasInitialOverrides =
    initialFormData && Object.keys(initialFormData).length > 0;

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
          Confirm Save Changes ({changes.length}{' '}
          {changes.length === 1 ? 'change' : 'changes'})
        </Typography>
        <Box
          mt={2}
          mb={2}
          p={2}
          style={{
            backgroundColor: '#f5f5f5',
            borderRadius: '4px',
            maxHeight: '300px',
            overflow: 'auto',
          }}
        >
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
          This will trigger a redeployment of the{' '}
          <strong>{environment?.name}</strong> environment.
        </Typography>
      </Box>
    );
  };

  const renderDialogContent = () => {
    if (showDeleteConfirm) {
      return (
        <Box className={classes.errorContainer}>
          <Typography variant="h6" gutterBottom>
            Delete Overrides?
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Are you sure you want to delete all environment overrides for{' '}
            <strong>{environment?.name}</strong>? This will revert to default
            settings and trigger a redeployment.
          </Typography>
        </Box>
      );
    }

    if (showSaveConfirm) {
      return (
        <Box className={classes.errorContainer}>{renderChangesPreview()}</Box>
      );
    }

    return (
      <>
        {loading && (
          <div className={classes.loadingContainer}>
            <CircularProgress />
          </div>
        )}

        {error && !loading && (
          <div className={classes.errorContainer}>
            <Typography color="error">{error}</Typography>
            <Button onClick={loadSchemaAndBinding} variant="outlined">
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && schema && (
          <>
            {!hasOverrides && (
              <Box className={classes.helpText}>
                <Typography variant="body2" gutterBottom>
                  <strong>Environment Overrides</strong>
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Configure environment-specific settings for your component's
                  containers, such as environment variables and file mounts.
                  These overrides apply only to the{' '}
                  <strong>{environment?.name}</strong> environment.
                </Typography>
              </Box>
            )}

            <Form
              schema={schema}
              formData={formData}
              onChange={handleFormChange}
              validator={validator}
              liveValidate={false}
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
    if (showDeleteConfirm) {
      return (
        <Box display="flex" justifyContent="flex-end" width="100%">
          <Button onClick={handleCancelDelete} disabled={deleting}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="secondary"
            variant="contained"
            disabled={deleting}
            style={{ marginLeft: 8 }}
          >
            {deleting ? 'Deleting...' : 'Confirm Delete'}
          </Button>
        </Box>
      );
    }

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
            {saving ? 'Saving...' : 'Confirm Save'}
          </Button>
        </Box>
      );
    }

    return (
      <Box display="flex" justifyContent="space-between" width="100%">
        <Button
          onClick={handleDeleteClick}
          color="secondary"
          disabled={deleting || saving || loading || !hasInitialOverrides}
        >
          Delete Overrides
        </Button>
        <Box>
          <Button onClick={onClose} disabled={saving || deleting}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveClick}
            variant="contained"
            color="primary"
            disabled={saving || deleting || loading || !!error}
            style={{ marginLeft: 8 }}
          >
            Save Overrides
          </Button>
        </Box>
      </Box>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            Configure Overrides - {environment?.name}
          </Typography>
          <IconButton onClick={onClose} size="small">
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
