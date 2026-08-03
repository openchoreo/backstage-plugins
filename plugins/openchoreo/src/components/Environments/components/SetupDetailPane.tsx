import { useCallback, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  Switch,
  Tooltip,
  Typography,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import CloseIcon from '@material-ui/icons/Close';
import CodeOutlinedIcon from '@material-ui/icons/CodeOutlined';
import FileCopyOutlinedIcon from '@material-ui/icons/FileCopyOutlined';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import RefreshIcon from '@material-ui/icons/Refresh';
import SettingsOutlinedIcon from '@material-ui/icons/SettingsOutlined';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useEnvironmentDetailPanelStyles } from '../styles';
import { LoadingSkeleton } from './LoadingSkeleton';
import { AutoDeployConfirmationDialog } from './AutoDeployConfirmationDialog';
import { DeployReleasePanel } from './DeployReleasePanel';
import { NotificationBanner } from './NotificationBanner';
import { DeploymentFailureBanner } from './DeploymentFailureBanner';
import { ProjectNotDeployedCallout } from './ProjectNotDeployedCallout';
import {
  isProjectBlocking,
  isProjectPending,
} from '../utils/projectDeployment';
import { ReleaseBrowserDialog } from './ReleaseBrowserDialog';
import { ReleaseManifestDialog } from './ReleaseManifestDialog';
import type { ComponentRelease } from '@openchoreo/backstage-plugin-common';
import { useAutoDeployUpdate } from '../hooks/useAutoDeployUpdate';
import { useReleases } from '../hooks/useReleases';
import { useReleaseReadiness } from '../hooks/useReleaseReadiness';
import { useEnvironmentsContext } from '../EnvironmentsContext';
import { useConfigureAndDeployPermission } from '@openchoreo/backstage-plugin-react';
import { RefreshOverlay } from '@openchoreo/backstage-design-system';
import { useNotification } from '../../../hooks';
import { isForbiddenError, getErrorMessage } from '../../../utils/errorUtils';
import {
  extractImage,
  formatRelativeTime,
  shortenImage,
  type ReleaseDeployments,
} from './releaseFormatters';

interface LatestReleaseRowProps {
  releases: ComponentRelease[];
  releasesLoading: boolean;
  deployments: ReleaseDeployments;
  firstEnvironmentName: string;
  /**
   * Controller-managed name of the latest ComponentRelease, mirrored from
   * `Component.status.latestRelease.name`. Authoritative — picking
   * newest-by-creation-timestamp would surface orphan releases that have
   * no ReleaseBinding referencing them.
   */
  latestReleaseName: string | null;
  /**
   * True while we're polling the controller after a UI-driven save.
   * Renders the inline "Deploying…" pill on the row.
   */
  awaitingNewRelease: boolean;
  /**
   * Called when the user clicks the copy icon. Parent owns notification
   * + clipboard availability handling so we can surface a success/error
   * toast without coupling this presentational row to the hooks.
   */
  onCopyReleaseName: (name: string) => void;
}

/**
 * Read-only "Last deployed release" row used when auto-deploy is on. Matches the
 * env-detail-card pattern of `Release: <name> [view] [copy]`. View opens
 * the YAML manifest dialog; from there users can pivot into the full
 * release browser (kept in readOnly under auto-deploy — the controller
 * owns release selection).
 */
const LatestReleaseRow = ({
  releases,
  releasesLoading,
  deployments,
  firstEnvironmentName,
  latestReleaseName,
  awaitingNewRelease,
  onCopyReleaseName,
}: LatestReleaseRowProps) => {
  const classes = useEnvironmentDetailPanelStyles();
  const [manifestOpen, setManifestOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  // Source of truth is the controller's status pointer. The `releases`
  // list is only used to resolve creation time + image for the meta line
  // when the matching CR is already cached locally; if it isn't yet (the
  // controller created the release but useReleases hasn't refetched),
  // render the name without meta — better than rendering a stale one.
  const latest = latestReleaseName
    ? releases.find(r => r.metadata?.name === latestReleaseName) ?? null
    : null;
  const latestName = latestReleaseName ?? undefined;

  // Small reusable inline pill rendered while the controller is
  // reconciling a UI-triggered save. Sits next to the release name
  // so the user sees both "what's deployed today" and "deploy in
  // flight" at a glance.
  const deployingPill = (
    <Box
      display="flex"
      alignItems="center"
      gridGap={4}
      ml={0.5}
      style={{ flexShrink: 0 }}
    >
      <CircularProgress size={12} />
      <Typography variant="caption" color="textSecondary">
        Deploying…
      </Typography>
    </Box>
  );

  return (
    <Box display="flex" flexDirection="column" gridGap={4}>
      {releasesLoading && !latestName && !awaitingNewRelease && (
        <Typography variant="body2" color="textSecondary">
          Loading…
        </Typography>
      )}
      {!releasesLoading && !latestName && !awaitingNewRelease && (
        <Typography variant="body2" color="textSecondary">
          No release yet. Auto-deploy will create one after you save the
          workload.
        </Typography>
      )}
      {!latestName && awaitingNewRelease && (
        <Box display="flex" flexDirection="column">
          <Typography variant="caption" className={classes.releaseNameLabel}>
            Last deployed release
          </Typography>
          <Box className={classes.releaseNameRow} style={{ marginTop: 0 }}>
            {deployingPill}
          </Box>
        </Box>
      )}
      {latestName &&
        (() => {
          const age = formatRelativeTime(latest?.metadata?.creationTimestamp);
          const image = latest ? extractImage(latest) : undefined;
          const metaParts = [
            age,
            image ? `img: ${shortenImage(image)}` : '',
          ].filter(Boolean);
          return (
            <Box display="flex" flexDirection="column">
              <Typography
                variant="caption"
                className={classes.releaseNameLabel}
              >
                Last deployed release
              </Typography>
              <Box className={classes.releaseNameRow} style={{ marginTop: 0 }}>
                <Tooltip title={latestName}>
                  <Typography variant="caption" className={classes.releaseName}>
                    {latestName}
                  </Typography>
                </Tooltip>
                {awaitingNewRelease && deployingPill}
                <Tooltip title="View release">
                  <IconButton
                    size="small"
                    aria-label="View release"
                    onClick={() => setManifestOpen(true)}
                  >
                    <CodeOutlinedIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Copy release name">
                  <IconButton
                    size="small"
                    aria-label="Copy release name"
                    onClick={() => onCopyReleaseName(latestName)}
                  >
                    <FileCopyOutlinedIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              </Box>
              {metaParts.length > 0 && (
                <Typography variant="caption" color="textSecondary">
                  {metaParts.join(' · ')}
                </Typography>
              )}
            </Box>
          );
        })()}
      <ReleaseManifestDialog
        open={manifestOpen}
        onClose={() => setManifestOpen(false)}
        releaseName={latestName}
        environmentName={firstEnvironmentName}
        onOpenReleaseBrowser={() => setBrowserOpen(true)}
      />
      <ReleaseBrowserDialog
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
        releases={releases}
        deployments={deployments}
        selectedReleaseName={latestName ?? null}
        onConfirm={() => {}}
        environmentName={firstEnvironmentName}
        loading={releasesLoading}
        readOnly
      />
    </Box>
  );
};

export interface SetupDetailPaneProps {
  environmentsExist: boolean;
  isWorkloadEditorSupported: boolean;
  loading: boolean;
  onConfigureWorkload: () => void;
  onClose: () => void;
}

/**
 * Right-pane body shown when the canvas Setup tile is selected.
 *
 * Story 1 ("Create a release"): edit workload (via existing config page) and
 * snapshot the current state as a named ComponentRelease.
 *
 * Story 2 ("Deploy a release"): pick from existing releases and deploy to
 * the first environment, with the option to configure per-env overrides.
 */
export const SetupDetailPane = ({
  environmentsExist,
  isWorkloadEditorSupported,
  loading,
  onConfigureWorkload,
  onClose,
}: SetupDetailPaneProps) => {
  const classes = useEnvironmentDetailPanelStyles();
  const { entity } = useEntity();
  const notification = useNotification();
  const {
    environments,
    lowestEnvironment,
    autoDeploy,
    autoDeployLoading,
    refetch: refetchEnvironments,
    refetchAutoDeploy,
    setAutoDeployOptimistic,
    latestReleaseName,
    awaitingNewRelease,
    componentError,
  } = useEnvironmentsContext();
  const { updateAutoDeploy, isUpdating: autoDeployUpdating } =
    useAutoDeployUpdate(entity);
  const {
    canConfigureAndDeploy,
    loading: permissionLoading,
    deniedTooltip,
  } = useConfigureAndDeployPermission();
  const readiness = useReleaseReadiness(entity);

  const {
    releases,
    loading: releasesLoading,
    isRefetching: releasesRefetching,
    error: releasesError,
  } = useReleases(entity);

  const [showAutoDeployConfirm, setShowAutoDeployConfirm] = useState(false);
  const [pendingAutoDeployValue, setPendingAutoDeployValue] = useState(false);
  const [selectedReleaseName, setSelectedReleaseName] = useState<string | null>(
    null,
  );

  const handleToggleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPendingAutoDeployValue(event.target.checked);
    setShowAutoDeployConfirm(true);
  };

  // Surface clipboard outcome to the user — the silent
  // navigator.clipboard?.writeText(...) pattern leaves no signal on
  // success and swallows failures (clipboard blocked by browser
  // permissions, insecure context, etc.).
  const handleCopyReleaseName = useCallback(
    async (name: string) => {
      if (!navigator.clipboard?.writeText) {
        notification.showError('Clipboard unavailable in this browser.');
        return;
      }
      try {
        await navigator.clipboard.writeText(name);
        notification.showSuccess('Release name copied.');
      } catch {
        notification.showError('Failed to copy release name.');
      }
    },
    [notification],
  );

  // Optimistic confirm: close the dialog immediately, flip the toggle
  // locally, run the PATCH in the background. On failure we snap back
  // and surface the error. No refetch on success — the PATCH response
  // is the truth and a refetch would flip `loading` and trigger the
  // card-wide skeleton just to confirm a single boolean.
  // Forbidden gets a permission-specific message so users in restricted
  // environments don't get a generic "failed" toast for what's
  // actually an authz outcome.
  const handleConfirmAutoDeploy = useCallback(async () => {
    const next = pendingAutoDeployValue;
    const previous = autoDeploy;
    setShowAutoDeployConfirm(false);
    setAutoDeployOptimistic(next);
    try {
      await updateAutoDeploy(next);
      notification.showSuccess(
        `Auto deploy ${next ? 'enabled' : 'disabled'} successfully`,
      );
    } catch (err) {
      setAutoDeployOptimistic(previous);
      notification.showError(
        isForbiddenError(err)
          ? 'You do not have permission to change auto deploy.'
          : `Failed to update auto deploy setting: ${getErrorMessage(err)}`,
      );
    }
  }, [
    pendingAutoDeployValue,
    autoDeploy,
    setAutoDeployOptimistic,
    updateAutoDeploy,
    notification,
  ]);

  // Build deployments map: releaseName → [envName, ...]
  const deployments: ReleaseDeployments = useMemo(() => {
    const map: ReleaseDeployments = {};
    for (const env of environments) {
      const name = env.deployment?.releaseName;
      if (!name) continue;
      if (!map[name]) map[name] = [];
      map[name].push(env.name);
    }
    return map;
  }, [environments]);

  const createDisabledReason = (() => {
    if (!canConfigureAndDeploy) return deniedTooltip;
    if (!readiness.canCreateRelease) {
      return readiness.alertMessage ?? 'Not ready to create a release.';
    }
    return '';
  })();
  const canCreate =
    !permissionLoading && canConfigureAndDeploy && readiness.canCreateRelease;

  // A component can only deploy into an environment where its project is
  // deployed (the project owns the cell namespace). Block the manual Deploy
  // for the first env when the project isn't deployed there, and surface the
  // fix; a `pending` project deployment is not blocked (the controller
  // converges) but is noted. Creating a release is never blocked.
  //
  // `lowestEnvironment` is `environments[0].name` lowercased, so match
  // case-insensitively (the env's display name keeps its original casing).
  const firstEnv = environments.find(
    e => e.name.toLowerCase() === lowestEnvironment.toLowerCase(),
  );
  const projectBlocked = !!firstEnv && isProjectBlocking(firstEnv);
  const projectPending = !!firstEnv && isProjectPending(firstEnv);

  return (
    <Box className={classes.panel} position="relative">
      <RefreshOverlay
        active={releasesRefetching || readiness.isRefetching}
        label="Refreshing setup"
      />
      <NotificationBanner notification={notification.notification} />
      <Box className={classes.setupHeader}>
        <Box className={classes.headerTopRow}>
          <Box className={classes.headerStatusRow}>
            <SettingsOutlinedIcon fontSize="small" />
            <Typography className={classes.envName}>Set up</Typography>
          </Box>
          <Box>
            <IconButton
              size="small"
              onClick={() => {
                // Manual escape hatch for the post-save 30s poll. Refreshes
                // both data sources: Component status (drives the setup row
                // identity) and env list (drives per-env Dev card binding).
                refetchAutoDeploy();
                refetchEnvironments();
              }}
              aria-label="Refresh"
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={onClose}
              aria-label="Close detail panel"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      </Box>

      <Box className={classes.setupBody}>
        {(loading && !environmentsExist) || autoDeployLoading ? (
          <LoadingSkeleton variant="setup" />
        ) : (
          <>
            <Typography variant="body2" color="textSecondary">
              Create releases from your component, then deploy them to{' '}
              {lowestEnvironment}.
            </Typography>

            <Box display="flex" alignItems="center" mt={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={autoDeploy ?? false}
                    onChange={handleToggleChange}
                    name="autoDeploy"
                    color="primary"
                    disabled={autoDeployLoading || autoDeployUpdating}
                  />
                }
                label={<Typography variant="body2">Auto Deploy</Typography>}
              />
              <Tooltip
                title="Enabling auto deploy will automatically deploy the component to the lowest environment when component configurations change."
                placement="bottom"
                arrow
              >
                <IconButton size="small" style={{ padding: 4, marginLeft: -8 }}>
                  <InfoOutlinedIcon style={{ fontSize: 18 }} color="primary" />
                </IconButton>
              </Tooltip>
              {autoDeployUpdating && (
                <Box
                  display="flex"
                  alignItems="center"
                  gridGap={4}
                  ml={1}
                  aria-live="polite"
                >
                  <CircularProgress size={12} />
                  <Typography variant="caption" color="textSecondary">
                    Saving…
                  </Typography>
                </Box>
              )}
            </Box>

            <Divider style={{ margin: '12px 0' }} />

            {autoDeploy ? (
              /* Auto-deploy ON: single "Deploy" section listing the latest
                 release alongside the Configure-component action. */
              <Box display="flex" flexDirection="column" gridGap={8}>
                <Typography variant="subtitle2">Deploy</Typography>
                <Typography
                  variant="caption"
                  color="textSecondary"
                  style={{ marginBottom: 8 }}
                >
                  Auto-deploy is on. Saving any configuration change creates a
                  release automatically and rolls it out to {lowestEnvironment}.
                </Typography>
                {readiness.alertMessage && (
                  <Alert severity={readiness.alertSeverity}>
                    {readiness.alertMessage}
                  </Alert>
                )}
                {componentError && !awaitingNewRelease && (
                  <DeploymentFailureBanner
                    message={componentError.message}
                    reason={componentError.reason}
                  />
                )}
                <LatestReleaseRow
                  releases={releases}
                  releasesLoading={releasesLoading}
                  deployments={deployments}
                  firstEnvironmentName={lowestEnvironment}
                  latestReleaseName={latestReleaseName}
                  awaitingNewRelease={awaitingNewRelease}
                  onCopyReleaseName={handleCopyReleaseName}
                />
                {isWorkloadEditorSupported && (
                  <Box display="flex" justifyContent="flex-start" mt={1}>
                    <Tooltip title={createDisabledReason}>
                      <span>
                        <Button
                          variant="contained"
                          color="primary"
                          size="small"
                          startIcon={<SettingsOutlinedIcon />}
                          onClick={onConfigureWorkload}
                          disabled={!canCreate || readiness.loading}
                        >
                          Configure & deploy
                        </Button>
                      </span>
                    </Tooltip>
                  </Box>
                )}
              </Box>
            ) : (
              <>
                {readiness.alertMessage && (
                  <Alert severity={readiness.alertSeverity}>
                    {readiness.alertMessage}
                  </Alert>
                )}
                <DeployReleasePanel
                  releases={releases}
                  releasesLoading={releasesLoading}
                  releasesError={releasesError}
                  deployments={deployments}
                  selectedReleaseName={selectedReleaseName}
                  onSelectedReleaseChange={setSelectedReleaseName}
                  firstEnvironmentName={lowestEnvironment}
                  disabled={
                    permissionLoading ||
                    !canConfigureAndDeploy ||
                    projectBlocked
                  }
                  disabledReason={
                    projectBlocked
                      ? `Project is not deployed to ${lowestEnvironment} yet.`
                      : deniedTooltip
                  }
                  onCreateRelease={
                    isWorkloadEditorSupported ? onConfigureWorkload : undefined
                  }
                  canCreateRelease={canCreate && !readiness.loading}
                  createDisabledReason={createDisabledReason}
                />
                {projectBlocked && firstEnv && (
                  <Box mt={2}>
                    <ProjectNotDeployedCallout
                      variant="setup"
                      envName={firstEnv.name}
                      envResourceName={firstEnv.resourceName}
                    />
                  </Box>
                )}
                {projectPending && !projectBlocked && (
                  <Alert severity="info">
                    Project deployment to {lowestEnvironment} is still in
                    progress.
                  </Alert>
                )}
              </>
            )}
          </>
        )}
      </Box>

      <AutoDeployConfirmationDialog
        open={showAutoDeployConfirm}
        onCancel={() => setShowAutoDeployConfirm(false)}
        onConfirm={handleConfirmAutoDeploy}
        isEnabling={pendingAutoDeployValue}
        isUpdating={autoDeployUpdating}
      />
    </Box>
  );
};
