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
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';
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
  emptyState: {
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
    padding: theme.spacing(4),
    textAlign: 'center',
  },
}));

export interface ProjectParametersConfigPageProps {
  onBack: () => void;
  /**
   * Called after the Project is saved AND a new ProjectRelease name is
   * known (or the existing release if the user made no changes). Receives
   * the first env's K8s ref and the release to pin.
   */
  onContinue: (firstEnvRef: string, releaseName: string) => void;
}

const POLL_INTERVAL_MS = 1_000;
const POLL_TIMEOUT_MS = 30_000;

/**
 * Edits `Project.spec.parameters` against the per-type RJSF schema fetched
 * from the (Cluster)ProjectType the Project references.
 *
 * Saving PUTs the Project and (when parameters changed) polls
 * `fetchProjectEnvironmentInfo` until the controller-cut release name
 * differs from the pre-save baseline, then hands the new release + first
 * env to the parent so the overrides wizard can pin them.
 */
export const ProjectParametersConfigPage = ({
  onBack,
  onContinue,
}: ProjectParametersConfigPageProps) => {
  const classes = useStyles();
  const { entity } = useEntity();
  const client = useApi(openChoreoClientApiRef);
  const notification = useNotification();
  const {
    canUpdate,
    loading: permLoading,
    updateDeniedTooltip,
  } = useProjectUpdatePermission();
  const cancelledRef = useRef(false);

  const [project, setProject] = useState<Record<string, unknown> | null>(null);
  const [schema, setSchema] = useState<JSONSchema7 | null>(null);
  const [parameters, setParameters] = useState<Record<string, unknown>>({});
  const [initialParameters, setInitialParameters] = useState<
    Record<string, unknown>
  >({});
  /**
   * When the Project has no stored parameters, RJSF auto-fills schema
   * defaults on its first onChange and we adopt that normalized snapshot
   * as the baseline (otherwise hasChanges would flip true on mount).
   * When parameters are already stored, those values ARE the baseline and
   * we skip the capture so a real user edit isn't mistaken for initial
   * state.
   */
  const formInitializedRef = useRef(true);
  const [firstEnvRef, setFirstEnvRef] = useState<string | null>(null);
  const [baselineRelease, setBaselineRelease] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [phase, setPhase] = useState<'idle' | 'saving' | 'awaiting-release'>(
    'idle',
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  const namespaceName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] || '';
  const projectName = entity.metadata.name;
  const projectTypeName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT_TYPE] || '';
  const projectTypeKind =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT_TYPE_KIND] ||
    'ProjectType';
  const typeDisplayName = projectTypeName || 'this project';

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    const load = async () => {
      try {
        // The project-level parameters schema lives on the referenced
        // (Cluster)ProjectType at spec.parameters.openAPIV3Schema. Cluster
        // types are cluster-scoped, so getResourceDefinition ignores the
        // namespace for them.
        const ptApiKind =
          projectTypeKind === 'ClusterProjectType'
            ? 'clusterprojecttypes'
            : 'projecttypes';

        const schemaPromise = projectTypeName
          ? client
              .getResourceDefinition(ptApiKind, namespaceName, projectTypeName)
              .then(cr => {
                const ptSpec = (cr?.spec as Record<string, unknown>) || {};
                const params =
                  (ptSpec.parameters as
                    | { openAPIV3Schema?: Record<string, unknown> }
                    | undefined) ?? {};
                return params.openAPIV3Schema ?? {};
              })
          : Promise.resolve({} as Record<string, unknown>);

        const [projectData, schemaData, envs] = await Promise.all([
          client.getResourceDefinition('projects', namespaceName, projectName),
          schemaPromise,
          client.fetchProjectEnvironmentInfo(entity),
        ]);

        if (cancelled) return;

        setProject(projectData);
        const spec = (projectData?.spec as Record<string, unknown>) || {};
        const currentParams =
          (spec.parameters as Record<string, unknown>) || {};
        // Empty stored params → allow the first RJSF onChange to absorb
        // schema-default expansion as the baseline. Otherwise the stored
        // params are the baseline directly.
        formInitializedRef.current = Object.keys(currentParams).length > 0;
        setParameters(currentParams);
        setInitialParameters(JSON.parse(JSON.stringify(currentParams)));

        setSchema((schemaData as JSONSchema7) ?? ({} as JSONSchema7));

        const firstEnv = envs[0];
        setFirstEnvRef(firstEnv?.resourceName ?? firstEnv?.name ?? null);
        setBaselineRelease(firstEnv?.latestRelease ?? '');
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
  }, [
    client,
    entity,
    namespaceName,
    projectName,
    projectTypeName,
    projectTypeKind,
  ]);

  const hasChanges = useMemo(
    () => JSON.stringify(parameters) !== JSON.stringify(initialParameters),
    [parameters, initialParameters],
  );

  const hasFields =
    !!schema?.properties && Object.keys(schema.properties).length > 0;

  /**
   * Polls fetchProjectEnvironmentInfo until the first env's `latestRelease`
   * differs from the captured baseline (or a previously unset release
   * becomes set). Resolves with the new release name or rejects on timeout.
   */
  const waitForNewRelease = useCallback(async (): Promise<string> => {
    const start = Date.now();
    while (!cancelledRef.current) {
      if (Date.now() - start > POLL_TIMEOUT_MS) {
        throw new Error(
          'Timed out waiting for the new ProjectRelease to be cut by the controller.',
        );
      }
      try {
        const envs = await client.fetchProjectEnvironmentInfo(entity);
        const current = envs[0]?.latestRelease ?? '';
        if (current && current !== baselineRelease) {
          return current;
        }
      } catch {
        // Transient errors are tolerated within the poll window.
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    throw new Error('cancelled');
  }, [baselineRelease, client, entity]);

  const handleContinue = useCallback(async () => {
    if (!firstEnvRef) {
      setSaveError(
        'No environments found in the deployment pipeline. Configure environments before deploying.',
      );
      return;
    }

    // Unchanged parameters: skip the PUT + poll and reuse the current
    // release immediately. Defensive against empty baseline (very fresh
    // Project that hasn't yet been reconciled).
    if (!hasChanges) {
      if (!baselineRelease) {
        setSaveError(
          'No release exists yet. Wait a moment for the controller to cut the first release, then try again.',
        );
        return;
      }
      onContinue(firstEnvRef, baselineRelease);
      return;
    }

    if (!project) return;

    setPhase('saving');
    setSaveError(null);
    try {
      const next: Record<string, unknown> = {
        ...project,
        spec: {
          ...((project.spec as Record<string, unknown>) || {}),
          parameters,
        },
      };
      await client.updateResourceDefinition(
        'projects',
        namespaceName,
        projectName,
        next,
      );
      if (cancelledRef.current) return;

      setPhase('awaiting-release');
      const newRelease = await waitForNewRelease();
      if (cancelledRef.current) return;

      notification.showSuccess(
        `Saved configuration for ${projectName}; release ${newRelease} cut.`,
      );
      onContinue(firstEnvRef, newRelease);
    } catch (err: unknown) {
      // Skip state writes if the user navigated away while a request was in
      // flight or the poll loop was still iterating — the component is gone
      // and React would warn about updating an unmounted component.
      if (!cancelledRef.current) setSaveError(getErrorMessage(err));
    } finally {
      if (!cancelledRef.current) setPhase('idle');
    }
  }, [
    baselineRelease,
    client,
    firstEnvRef,
    hasChanges,
    namespaceName,
    notification,
    onContinue,
    parameters,
    project,
    projectName,
    waitForNewRelease,
  ]);

  let primaryLabel: string;
  if (phase === 'saving') {
    primaryLabel = 'Saving';
  } else if (phase === 'awaiting-release') {
    primaryLabel = 'Cutting release';
  } else {
    primaryLabel = 'Next';
  }

  const actionDenied = !permLoading && !canUpdate;
  const headerActions = !loading && !loadError && (
    <Tooltip
      title={actionDenied ? updateDeniedTooltip : ''}
      disableHoverListener={!actionDenied}
    >
      <span>
        <Button
          variant="contained"
          color="primary"
          onClick={handleContinue}
          disabled={
            phase !== 'idle' ||
            permLoading ||
            !canUpdate ||
            !project ||
            !firstEnvRef ||
            (!hasChanges && !baselineRelease)
          }
          startIcon={
            phase !== 'idle' ? (
              <CircularProgress size={20} color="inherit" />
            ) : undefined
          }
        >
          {primaryLabel}
        </Button>
      </span>
    </Tooltip>
  );

  if (isForbiddenError(loadError)) {
    return (
      <ForbiddenState
        message="You do not have permission to configure this project."
        minHeight="400px"
      />
    );
  }

  return (
    <DetailPageLayout
      title="Configure Project"
      subtitle={`Edit the parameters bound to the ${typeDisplayName} schema. Saving cuts a new release.`}
      onBack={onBack}
      actions={headerActions}
    >
      <NotificationBanner notification={notification.notification} />

      {loading && (
        <Box className={classes.loadingContainer}>
          <Skeleton variant="rect" width="100%" height={64} />
          <Skeleton variant="rect" width="100%" height={120} />
          <Skeleton variant="rect" width="100%" height={120} />
        </Box>
      )}

      {loadError && !loading && (
        <Box mb={2}>
          <Alert severity="error">
            Failed to load project configuration: {getErrorMessage(loadError)}
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

      {!loading && !loadError && !firstEnvRef && (
        <Box mb={2}>
          <Alert severity="info">
            No environments are configured in the project&apos;s deployment
            pipeline. Configure environments before deploying this project.
          </Alert>
        </Box>
      )}

      {!loading && !loadError && (
        <Box className={classes.formCard}>
          {hasFields ? (
            <>
              <Typography className={classes.formHint}>
                Fill in the parameters defined by {typeDisplayName}.
              </Typography>
              <RjsfForm
                schema={schema as any}
                uiSchema={{}}
                formData={parameters}
                onChange={data => {
                  const next = (data.formData ?? {}) as Record<string, unknown>;
                  setParameters(next);
                  if (!formInitializedRef.current) {
                    setInitialParameters(next);
                    formInitializedRef.current = true;
                  }
                }}
                tagName="div"
              />
            </>
          ) : (
            <Typography className={classes.emptyState}>
              {typeDisplayName} has no configurable parameters.
            </Typography>
          )}
        </Box>
      )}
    </DetailPageLayout>
  );
};
