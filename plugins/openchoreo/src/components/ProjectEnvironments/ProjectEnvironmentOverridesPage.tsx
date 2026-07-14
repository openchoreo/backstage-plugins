import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Tooltip,
  Typography,
  makeStyles,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import type { JSONSchema7 } from 'json-schema';
import { useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import {
  DetailPageLayout,
  ForbiddenState,
  useProjectUpdatePermission,
} from '@openchoreo/backstage-plugin-react';
import { RjsfForm, Skeleton } from '@openchoreo/backstage-design-system';
import {
  openChoreoClientApiRef,
  type ProjectEnvironment,
} from '../../api/OpenChoreoClientApi';
import { isForbiddenError, getErrorMessage } from '../../utils/errorUtils';
import { useNotification } from '../../hooks';
import { NotificationBanner } from '../Environments/components';

const useStyles = makeStyles(theme => ({
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    padding: theme.spacing(4),
  },
  formCard: {
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 12,
    padding: theme.spacing(3),
  },
  formHint: {
    color: theme.palette.text.secondary,
    fontSize: theme.typography.body2.fontSize,
    marginBottom: theme.spacing(2),
  },
  actionsRow: {
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'center',
  },
  emptyState: {
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
    padding: theme.spacing(4),
    textAlign: 'center',
  },
}));

export interface ProjectEnvironmentOverridesPageProps {
  envName: string;
  /**
   * When set, the wizard runs in deploy mode: the binding is pinned to
   * this release on save and the primary action reads "Deploy". Comes from
   * the wizard chain that follows a project parameter edit.
   */
  releaseFromUrl?: string;
  onBack: () => void;
  onSaved: () => void;
}

/**
 * Edits `ProjectReleaseBinding.spec.environmentConfigs` for a single
 * environment. Saving issues an upsert against the binding via the BFF —
 * the controller re-renders the namespace resources with the new
 * env-specific values layered over the project-level parameters.
 *
 * The schema comes from the snapshot stored on the pinned ProjectRelease
 * (not the live (Cluster)ProjectType) so the form validates against what
 * the release was actually cut against — the live type may have drifted.
 */
export const ProjectEnvironmentOverridesPage = ({
  envName,
  releaseFromUrl,
  onBack,
  onSaved,
}: ProjectEnvironmentOverridesPageProps) => {
  const classes = useStyles();
  const { entity } = useEntity();
  const client = useApi(openChoreoClientApiRef);
  const notification = useNotification();
  const {
    canUpdate,
    loading: permLoading,
    updateDeniedTooltip,
  } = useProjectUpdatePermission();

  const [envInfo, setEnvInfo] = useState<ProjectEnvironment | null>(null);
  const [schema, setSchema] = useState<JSONSchema7 | null>(null);
  const [overrides, setOverrides] = useState<Record<string, unknown>>({});
  const [initialOverrides, setInitialOverrides] = useState<
    Record<string, unknown>
  >({});
  /**
   * True when the binding had a non-empty environmentConfigs map. Distinct
   * from `hasChanges` because RJSF auto-fills defaults from the schema on
   * mount; we use the backend's perspective to gate the Clear Overrides
   * action.
   */
  const [hasActualOverrides, setHasActualOverrides] = useState(false);
  /**
   * When the backend has no stored overrides, RJSF auto-fills schema
   * defaults on its first onChange and we adopt that normalized snapshot as
   * the baseline (otherwise hasChanges would flip true on mount). When the
   * backend already has values, those values ARE the baseline and we skip
   * the capture so a real user edit isn't mistaken for initial state.
   */
  const formInitializedRef = useRef(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const projectTypeName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT_TYPE] ||
    'this project';
  const envDisplayName = envInfo?.name ?? envName;
  const hasBinding = Boolean(envInfo?.bindingName);
  const isDeployMode = Boolean(releaseFromUrl);

  const effectiveRelease =
    releaseFromUrl ?? envInfo?.projectRelease ?? envInfo?.latestRelease ?? '';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    const load = async () => {
      try {
        const [envs, bindings] = await Promise.all([
          client.fetchProjectEnvironmentInfo(entity),
          client.fetchProjectReleaseBindings(entity),
        ]);
        if (cancelled) return;

        const matchingEnv =
          envs.find(e => e.resourceName === envName || e.name === envName) ??
          null;
        setEnvInfo(matchingEnv);

        const envRef = matchingEnv?.resourceName ?? envName;
        const matchingBinding =
          bindings?.data?.items?.find(b => b.environment === envRef) ?? null;
        const backendOverrides =
          (matchingBinding?.environmentConfigs as
            | Record<string, unknown>
            | undefined) ?? {};
        const backendOverridesCopy = JSON.parse(
          JSON.stringify(backendOverrides),
        );

        // If the backend has stored values, those are the baseline; skip the
        // RJSF normalization capture so the user's first edit isn't mistaken
        // for initial state. Empty backend → allow capture to absorb
        // schema-default expansion.
        formInitializedRef.current = Object.keys(backendOverrides).length > 0;
        setOverrides(backendOverridesCopy);
        setInitialOverrides(backendOverridesCopy);
        setHasActualOverrides(Object.keys(backendOverrides).length > 0);

        const releaseForSchema =
          releaseFromUrl ??
          matchingEnv?.projectRelease ??
          matchingEnv?.latestRelease ??
          '';

        if (!releaseForSchema) {
          setSchema({} as JSONSchema7);
          return;
        }

        const namespaceName =
          entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] || '';
        const schemaResult = await client.fetchProjectReleaseSchema(
          namespaceName,
          releaseForSchema,
          'environmentConfigs',
        );
        if (cancelled) return;

        setSchema((schemaResult?.data as JSONSchema7) ?? ({} as JSONSchema7));
      } catch (err: unknown) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [client, entity, envName, releaseFromUrl]);

  const hasChanges = useMemo(
    () => JSON.stringify(overrides) !== JSON.stringify(initialOverrides),
    [overrides, initialOverrides],
  );

  const hasFields =
    !!schema?.properties && Object.keys(schema.properties).length > 0;

  const persist = useCallback(
    async (next: Record<string, unknown>) => {
      if (!effectiveRelease) {
        throw new Error(
          'No release available to bind. Save project parameters first to cut a release.',
        );
      }
      const envRef = envInfo?.resourceName ?? envName;
      await client.updateProjectReleaseBinding(entity, envRef, {
        projectRelease: effectiveRelease,
        environmentConfigs: next,
      });
    },
    [client, effectiveRelease, entity, envInfo?.resourceName, envName],
  );

  const handlePrimary = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await persist(overrides);
      notification.showSuccess(
        isDeployMode
          ? `Deployed ${effectiveRelease} to ${envDisplayName}.`
          : `Saved overrides for ${envDisplayName}.`,
      );
      onSaved();
    } catch (err: unknown) {
      setSaveError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }, [
    effectiveRelease,
    envDisplayName,
    isDeployMode,
    notification,
    onSaved,
    overrides,
    persist,
  ]);

  const handleClear = useCallback(async () => {
    setClearing(true);
    setSaveError(null);
    try {
      await persist({});
      notification.showSuccess(`Cleared overrides for ${envDisplayName}.`);
      onSaved();
    } catch (err: unknown) {
      setSaveError(getErrorMessage(err));
    } finally {
      setClearing(false);
    }
  }, [envDisplayName, notification, onSaved, persist]);

  const permDenied = !permLoading && !canUpdate;
  const canPrimary = isDeployMode ? Boolean(effectiveRelease) : hasBinding;
  const primaryDisabled =
    saving ||
    clearing ||
    permLoading ||
    !canUpdate ||
    !canPrimary ||
    (!isDeployMode && !hasChanges);
  let primaryLabel: string;
  if (isDeployMode) {
    primaryLabel = saving ? 'Deploying' : 'Deploy';
  } else {
    primaryLabel = saving ? 'Saving' : 'Save Overrides';
  }

  const headerActions = !loading && !loadError && (
    <Box className={classes.actionsRow}>
      {!isDeployMode && (
        <Button
          onClick={handleClear}
          disabled={
            saving ||
            clearing ||
            permLoading ||
            !canUpdate ||
            !hasActualOverrides ||
            !hasBinding
          }
        >
          {clearing ? 'Clearing' : 'Clear Overrides'}
        </Button>
      )}
      <Tooltip
        title={permDenied ? updateDeniedTooltip : ''}
        disableHoverListener={!permDenied}
      >
        <span>
          <Button
            variant="contained"
            color="primary"
            onClick={handlePrimary}
            disabled={primaryDisabled}
            startIcon={
              saving ? (
                <CircularProgress size={20} color="inherit" />
              ) : undefined
            }
          >
            {primaryLabel}
          </Button>
        </span>
      </Tooltip>
    </Box>
  );

  const subtitle = isDeployMode
    ? `Pin ${envDisplayName} to ${effectiveRelease} and set any ${envDisplayName}-specific overrides.`
    : `Set ${envDisplayName}-specific values that override the ${projectTypeName} defaults for this binding only.`;

  if (isForbiddenError(loadError)) {
    return (
      <ForbiddenState
        message="You do not have permission to configure overrides for this environment."
        minHeight="400px"
      />
    );
  }

  return (
    <DetailPageLayout
      title={`Configure Environment Overrides — ${envDisplayName}`}
      subtitle={subtitle}
      onBack={onBack}
      actions={headerActions}
    >
      <NotificationBanner notification={notification.notification} />

      {loading && (
        <Box className={classes.loadingContainer}>
          <Skeleton variant="rect" width="100%" height={64} />
          <Skeleton variant="rect" width="100%" height={120} />
        </Box>
      )}

      {loadError && !loading && (
        <Box mb={2}>
          <Alert severity="error">
            Failed to load overrides: {getErrorMessage(loadError)}
          </Alert>
        </Box>
      )}

      {!loading && !loadError && !isDeployMode && !hasBinding && (
        <Box mb={2}>
          <Alert severity="info">
            No binding exists for {envDisplayName} yet. Deploy this project to{' '}
            {envDisplayName} before configuring overrides.
          </Alert>
        </Box>
      )}

      {saveError && !loading && (
        <Box mb={2}>
          <Alert severity="error" onClose={() => setSaveError(null)}>
            {saveError}
          </Alert>
        </Box>
      )}

      {!loading && !loadError && (isDeployMode || hasBinding) && (
        <Box className={classes.formCard}>
          {hasFields ? (
            <>
              <Typography className={classes.formHint}>
                Only fields you fill in here are persisted as overrides on this
                binding. Empty fields inherit from the project&apos;s own
                parameters.
              </Typography>
              <RjsfForm
                schema={schema as any}
                uiSchema={{}}
                formData={overrides}
                onChange={data => {
                  const next = (data.formData ?? {}) as Record<string, unknown>;
                  setOverrides(next);
                  // RJSF normalizes formData on first render (e.g. injects
                  // schema defaults). Treat that normalized snapshot as the
                  // baseline so the user's actual edits surface as changes;
                  // without this, hasChanges flips true on mount.
                  if (!formInitializedRef.current) {
                    setInitialOverrides(next);
                    formInitializedRef.current = true;
                  }
                }}
                tagName="div"
              />
            </>
          ) : (
            <Typography className={classes.emptyState}>
              {projectTypeName} declares no environment-configs schema, so
              per-env overrides are not applicable for this release.
            </Typography>
          )}
        </Box>
      )}
    </DetailPageLayout>
  );
};
