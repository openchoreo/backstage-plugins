import { useState, useCallback, useEffect, useRef, useContext } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useApi, alertApiRef } from '@backstage/core-plugin-api';
import {
  useNavigate,
  UNSAFE_NavigationContext as NavigationContext,
} from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import Alert from '@material-ui/lab/Alert';
import {
  YamlEditor,
  useYamlEditor,
  LoadingState,
  ErrorState,
  ForbiddenState,
  UnsavedChangesDialog,
  NotificationBanner,
  useResourceDefinitionPermission,
} from '@openchoreo/backstage-plugin-react';
import { useResourceDefinition } from './useResourceDefinition';
import { isForbiddenError, getErrorMessage } from '../../utils/errorUtils';
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
  const alertApi = useApi(alertApiRef);
  const { canUpdate, loading: permissionsLoading } =
    useResourceDefinitionPermission();

  const [errorNotification, setErrorNotification] = useState<string | null>(
    null,
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
    rawError: fetchRawError,
    save,
    isSaving,
    refresh,
  } = useResourceDefinition({ entity });

  // Handle save
  const handleSave = useCallback(
    async (content: Record<string, unknown>) => {
      setErrorNotification(null);
      try {
        await save(content);
        alertApi.post({
          message: 'Resource saved successfully',
          severity: 'success',
          display: 'transient',
        });
      } catch (err) {
        const message = isForbiddenError(err)
          ? 'You do not have permission to save this resource. Contact your administrator.'
          : getErrorMessage(err);
        setErrorNotification(message);
        throw err; // Re-throw so useYamlEditor knows it failed
      }
    },
    [save, alertApi],
  );

  // YAML editor hook - only initialize when we have definition
  const yamlEditor = useYamlEditor({
    initialContent: definition || {},
    onSave: handleSave,
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
          Supported kinds: Component, ComponentType, TraitType, Workflow,
          ComponentWorkflow, Environment, DataPlane, WorkflowPlane,
          ObservabilityPlane, DeploymentPipeline, ClusterComponentType,
          ClusterTraitType, ClusterWorkflow, ClusterDataPlane,
          ClusterObservabilityPlane, ClusterWorkflowPlane
        </Typography>
      </Box>
    );
  }

  // Permission loading state
  if (permissionsLoading) {
    return <LoadingState message="Checking permissions..." />;
  }

  // Loading state
  if (isLoading) {
    return <LoadingState message="Loading resource definition..." />;
  }

  // Error state
  if (fetchError && !definition) {
    if (isForbiddenError(fetchRawError)) {
      return (
        <ForbiddenState
          message="You do not have permission to view this resource definition."
          onRetry={refresh}
          variant="fullpage"
        />
      );
    }
    return (
      <ErrorState
        title="Failed to load resource definition"
        message={fetchError}
        onRetry={refresh}
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

      {!canUpdate && (
        <NotificationBanner
          variant="info"
          showIcon
          message="You have read-only access to this resource definition. Contact your administrator for edit permissions."
        />
      )}

      {errorNotification && (
        <Box mb={2}>
          <Alert
            severity="error"
            onClose={() => setErrorNotification(null)}
          >
            {errorNotification}
          </Alert>
        </Box>
      )}

      <Box className={classes.editorContainer}>
        <YamlEditor
          content={yamlEditor.content}
          onChange={yamlEditor.setContent}
          onSave={yamlEditor.handleSave}
          onDiscard={yamlEditor.handleDiscard}
          errorText={editorError}
          isDirty={yamlEditor.isDirty}
          isSaving={isSaving}
          readOnly={!canUpdate}
        />
      </Box>

      <Box className={classes.syncNote}>
        <Typography variant="body2" color="textSecondary">
          Note: Changes made here will be reflected in the catalog after the
          next entity provider sync cycle.
        </Typography>
      </Box>

      {/* Unsaved changes confirmation dialog */}
      <UnsavedChangesDialog
        open={unsavedChangesDialogOpen}
        onDiscard={handleDiscardAndNavigate}
        onStay={handleStay}
        changeCount={1}
      />
    </Box>
  );
}
