import { useState, useCallback, useEffect, useRef, useContext } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  useNavigate,
  UNSAFE_NavigationContext as NavigationContext,
} from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogActions from '@material-ui/core/DialogActions';
import Snackbar from '@material-ui/core/Snackbar';
import Alert from '@material-ui/lab/Alert';
import {
  YamlEditor,
  useYamlEditor,
  LoadingState,
  ErrorState,
  UnsavedChangesDialog,
} from '@openchoreo/backstage-plugin-react';
import { useResourceDefinition } from './useResourceDefinition';
import { isSupportedKind } from './utils';

// Navigator type for overriding push/replace methods
interface Navigator {
  push: (to: string | { pathname: string }, state?: any) => void;
  replace: (to: string | { pathname: string }, state?: any) => void;
}

const useStyles = makeStyles(theme => ({
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    marginBottom: theme.spacing(2),
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editorContainer: {
    flex: 1,
    minHeight: 500,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    overflow: 'hidden',
  },
  unsupportedMessage: {
    padding: theme.spacing(4),
    textAlign: 'center',
  },
  syncNote: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(1, 2),
    backgroundColor: theme.palette.type === 'dark' ? '#2d2d2d' : '#f5f5f5',
    borderRadius: theme.shape.borderRadius,
  },
}));

/**
 * Tab component for viewing and editing platform resource CRD definitions.
 *
 * Displays a YAML editor with the full CRD for ComponentType, TraitType,
 * Workflow, and ComponentWorkflow entities.
 */
export function ResourceDefinitionTab() {
  const classes = useStyles();
  const { entity } = useEntity();
  const navigate = useNavigate();
  const navigation = useContext(NavigationContext);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>(
    'success',
  );
  const [unsavedChangesDialogOpen, setUnsavedChangesDialogOpen] =
    useState(false);

  // Refs for navigation blocking
  const allowNavigationRef = useRef(false);
  const pendingNavigationRef = useRef<{
    to: string;
    action: 'push' | 'replace';
  } | null>(null);

  const {
    definition,
    isLoading,
    error: fetchError,
    save,
    deleteResource,
    isSaving,
  } = useResourceDefinition({ entity });

  // Show success/error snackbar
  const showSnackbar = useCallback(
    (message: string, severity: 'success' | 'error') => {
      setSnackbarMessage(message);
      setSnackbarSeverity(severity);
      setSnackbarOpen(true);
    },
    [],
  );

  // Handle save
  const handleSave = useCallback(
    async (content: Record<string, unknown>) => {
      try {
        await save(content);
        showSnackbar('Resource saved successfully', 'success');
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to save resource';
        showSnackbar(message, 'error');
        throw err; // Re-throw so useYamlEditor knows it failed
      }
    },
    [save, showSnackbar],
  );

  // Handle delete
  const handleDelete = useCallback(async () => {
    try {
      await deleteResource();
      showSnackbar('Resource deleted successfully', 'success');
      setDeleteDialogOpen(false);
      // Navigate back to catalog after deletion
      navigate('/catalog');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete resource';
      showSnackbar(message, 'error');
    }
  }, [deleteResource, showSnackbar, navigate]);

  // YAML editor hook - only initialize when we have definition
  const yamlEditor = useYamlEditor({
    initialContent: definition || {},
    onSave: handleSave,
    onDelete: async () => {
      setDeleteDialogOpen(true);
    },
  });

  // Update editor when definition changes
  useEffect(() => {
    if (definition) {
      yamlEditor.reset(definition);
    }
  }, [definition]); // eslint-disable-line react-hooks/exhaustive-deps

  // Warn user before leaving page with unsaved changes (browser navigation/tab close)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (yamlEditor.isDirty && !allowNavigationRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [yamlEditor.isDirty]);

  // Block in-app navigation when there are unsaved changes
  useEffect(() => {
    if (!yamlEditor.isDirty || !navigation) {
      return undefined;
    }

    const navigator = navigation.navigator as Navigator;
    const originalPush = navigator.push;
    const originalReplace = navigator.replace;

    // Override push method
    navigator.push = (to: any, state?: any) => {
      if (allowNavigationRef.current) {
        originalPush.call(navigator, to, state);
        return;
      }

      // Store pending navigation
      pendingNavigationRef.current = {
        to: typeof to === 'string' ? to : to.pathname,
        action: 'push',
      };

      // Show confirmation dialog
      setUnsavedChangesDialogOpen(true);
    };

    // Override replace method
    navigator.replace = (to: any, state?: any) => {
      if (allowNavigationRef.current) {
        originalReplace.call(navigator, to, state);
        return;
      }

      // Store pending navigation
      pendingNavigationRef.current = {
        to: typeof to === 'string' ? to : to.pathname,
        action: 'replace',
      };

      // Show confirmation dialog
      setUnsavedChangesDialogOpen(true);
    };

    // Cleanup - restore original methods
    return () => {
      navigator.push = originalPush;
      navigator.replace = originalReplace;
    };
  }, [yamlEditor.isDirty, navigation]);

  // Handle discard from unsaved changes dialog
  const handleDiscardAndNavigate = useCallback(() => {
    allowNavigationRef.current = true;
    setUnsavedChangesDialogOpen(false);

    if (pendingNavigationRef.current) {
      const { to, action } = pendingNavigationRef.current;
      if (action === 'push') {
        navigate(to);
      } else {
        navigate(to, { replace: true });
      }
      pendingNavigationRef.current = null;
    }

    // Reset flag after navigation
    setTimeout(() => {
      allowNavigationRef.current = false;
    }, 100);
  }, [navigate]);

  // Handle stay from unsaved changes dialog
  const handleStay = useCallback(() => {
    setUnsavedChangesDialogOpen(false);
    pendingNavigationRef.current = null;
  }, []);

  // Check if entity kind is supported
  if (!isSupportedKind(entity.kind)) {
    return (
      <Box className={classes.unsupportedMessage}>
        <Typography variant="h6" color="textSecondary">
          Definition editing is not supported for {entity.kind} entities.
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Supported kinds: ComponentType, TraitType, Workflow, ComponentWorkflow
        </Typography>
      </Box>
    );
  }

  // Loading state
  if (isLoading) {
    return <LoadingState message="Loading resource definition..." />;
  }

  // Error state
  if (fetchError && !definition) {
    return (
      <ErrorState
        title="Failed to load resource definition"
        message={fetchError}
        onRetry={() => window.location.reload()}
      />
    );
  }

  // No definition found
  if (!definition) {
    return (
      <ErrorState
        title="Resource definition not found"
        message="The resource definition could not be retrieved from the cluster."
      />
    );
  }

  // Combine parse error and fetch error for display
  const editorError =
    yamlEditor.parseError ||
    (fetchError ? `Warning: ${fetchError}` : undefined);

  return (
    <Box className={classes.container}>
      <Box className={classes.header}>
        <Typography variant="h6">
          {entity.kind} Definition: {entity.metadata.name}
        </Typography>
      </Box>

      <Box className={classes.editorContainer}>
        <YamlEditor
          content={yamlEditor.content}
          onChange={yamlEditor.setContent}
          onSave={yamlEditor.handleSave}
          onDiscard={yamlEditor.handleDiscard}
          onDelete={() => setDeleteDialogOpen(true)}
          errorText={editorError}
          isDirty={yamlEditor.isDirty}
          isSaving={isSaving}
        />
      </Box>

      <Box className={classes.syncNote}>
        <Typography variant="body2" color="textSecondary">
          Note: Changes made here will be reflected in the catalog after the
          next entity provider sync cycle.
        </Typography>
      </Box>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete {entity.kind}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "{entity.metadata.name}"? This
            action cannot be undone and will remove the resource from the
            Kubernetes cluster.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} color="default">
            Cancel
          </Button>
          <Button onClick={handleDelete} color="secondary">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Unsaved changes confirmation dialog */}
      <UnsavedChangesDialog
        open={unsavedChangesDialogOpen}
        onDiscard={handleDiscardAndNavigate}
        onStay={handleStay}
        changeCount={1}
      />

      {/* Snackbar for success/error messages */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarSeverity}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
