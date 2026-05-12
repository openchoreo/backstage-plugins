import { useCallback, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Divider,
  FormControlLabel,
  IconButton,
  Switch,
  Tooltip,
  Typography,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import AddIcon from '@material-ui/icons/Add';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import CloseIcon from '@material-ui/icons/Close';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import SettingsOutlinedIcon from '@material-ui/icons/SettingsOutlined';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useEnvironmentDetailPanelStyles } from '../styles';
import { LoadingSkeleton } from './LoadingSkeleton';
import { AutoDeployConfirmationDialog } from './AutoDeployConfirmationDialog';
import { DeployReleasePanel } from './DeployReleasePanel';
import { ReleaseBrowserDialog } from './ReleaseBrowserDialog';
import type { ComponentRelease } from '@openchoreo/backstage-plugin-common';
import { useAutoDeployUpdate } from '../hooks/useAutoDeployUpdate';
import { useReleases } from '../hooks/useReleases';
import { useReleaseReadiness } from '../hooks/useReleaseReadiness';
import { useEnvironmentsContext } from '../EnvironmentsContext';
import { useConfigureAndDeployPermission } from '@openchoreo/backstage-plugin-react';
import { useNotification } from '../../../hooks';
import type { ReleaseDeployments } from './ReleasePicker';

interface LatestReleaseRowProps {
  releases: ComponentRelease[];
  releasesLoading: boolean;
  deployments: ReleaseDeployments;
  firstEnvironmentName: string;
}

/** Read-only "Latest release" row used when auto-deploy is on. Clicking opens
 *  the release browser in read-only mode so the user can inspect YAML without
 *  being able to pick a release (the controller controls that under auto-deploy). */
const LatestReleaseRow = ({
  releases,
  releasesLoading,
  deployments,
  firstEnvironmentName,
}: LatestReleaseRowProps) => {
  const [browserOpen, setBrowserOpen] = useState(false);
  // 'Latest' under auto-deploy = release currently bound to the first env.
  // Falls back to the first release in the list (sorted newest-first) when
  // no binding exists yet.
  const latest =
    releases.find(r =>
      (deployments[r.metadata?.name ?? ''] ?? []).includes(
        firstEnvironmentName,
      ),
    ) ??
    releases[0] ??
    null;

  return (
    <Box display="flex" flexDirection="column" gridGap={4}>
      <Typography variant="subtitle2">Latest release</Typography>
      {releasesLoading && !latest && (
        <Typography variant="body2" color="textSecondary">
          Loading…
        </Typography>
      )}
      {!releasesLoading && !latest && (
        <Typography variant="body2" color="textSecondary">
          No release yet. Auto-deploy will create one after you save the
          workload.
        </Typography>
      )}
      {latest && (
        <Box
          onClick={() => setBrowserOpen(true)}
          display="flex"
          alignItems="center"
          style={{ cursor: 'pointer', gap: 8 }}
        >
          <Typography variant="body2" style={{ fontWeight: 500 }}>
            {latest.metadata?.name}
          </Typography>
          {(deployments[latest.metadata?.name ?? ''] ?? []).includes(
            firstEnvironmentName,
          ) && (
            <Typography variant="caption" color="primary">
              current in {firstEnvironmentName}
            </Typography>
          )}
          <ChevronRightIcon fontSize="small" color="action" />
        </Box>
      )}
      <ReleaseBrowserDialog
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
        releases={releases}
        deployments={deployments}
        selectedReleaseName={latest?.metadata?.name ?? null}
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
    refetchAutoDeploy,
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
    error: releasesError,
  } = useReleases(entity);

  const [showAutoDeployConfirm, setShowAutoDeployConfirm] = useState(false);
  const [pendingAutoDeployValue, setPendingAutoDeployValue] = useState(false);
  const [selectedReleaseName, setSelectedReleaseName] = useState<string | null>(
    null,
  );

  const handleAutoDeployChange = useCallback(
    async (next: boolean) => {
      const ok = await updateAutoDeploy(next);
      if (ok) {
        refetchAutoDeploy();
        notification.showSuccess(
          `Auto deploy ${next ? 'enabled' : 'disabled'} successfully`,
        );
      } else {
        notification.showError('Failed to update auto deploy setting');
      }
    },
    [updateAutoDeploy, refetchAutoDeploy, notification],
  );

  const handleToggleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPendingAutoDeployValue(event.target.checked);
    setShowAutoDeployConfirm(true);
  };

  const handleConfirmAutoDeploy = () => {
    handleAutoDeployChange(pendingAutoDeployValue);
    setShowAutoDeployConfirm(false);
  };

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

  return (
    <Box className={classes.panel}>
      <Box className={classes.setupHeader}>
        <Box className={classes.headerTopRow}>
          <Box className={classes.headerStatusRow}>
            <SettingsOutlinedIcon fontSize="small" />
            <Typography className={classes.envName}>Set up</Typography>
          </Box>
          <IconButton
            size="small"
            onClick={onClose}
            aria-label="Close detail panel"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
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
                title={`When on, newly created releases automatically deploy to ${lowestEnvironment}.`}
                placement="bottom"
                arrow
              >
                <IconButton size="small" style={{ padding: 4, marginLeft: -8 }}>
                  <InfoOutlinedIcon style={{ fontSize: 18 }} color="primary" />
                </IconButton>
              </Tooltip>
            </Box>

            <Divider style={{ margin: '12px 0' }} />

            {autoDeploy ? (
              /* Auto-deploy ON: configure component + read-only latest release */
              <>
                <Box display="flex" flexDirection="column" gridGap={8}>
                  <Typography variant="subtitle2">Component</Typography>
                  {readiness.alertMessage && (
                    <Alert severity={readiness.alertSeverity}>
                      {readiness.alertMessage}
                    </Alert>
                  )}
                  {isWorkloadEditorSupported && (
                    <Box display="flex">
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
                            Configure component
                          </Button>
                        </span>
                      </Tooltip>
                    </Box>
                  )}
                  <Typography variant="caption" color="textSecondary">
                    Auto-deploy is on. Saving any configuration change creates a
                    release automatically and rolls it out to{' '}
                    {lowestEnvironment}.
                  </Typography>
                </Box>

                <Divider style={{ margin: '12px 0' }} />

                <LatestReleaseRow
                  releases={releases}
                  releasesLoading={releasesLoading}
                  deployments={deployments}
                  firstEnvironmentName={lowestEnvironment}
                />
              </>
            ) : (
              <>
                {/* Story 1 — Create release (routes to workload page) */}
                <Box display="flex" flexDirection="column" gridGap={8}>
                  <Typography variant="subtitle2">Release</Typography>
                  {readiness.alertMessage && (
                    <Alert severity={readiness.alertSeverity}>
                      {readiness.alertMessage}
                    </Alert>
                  )}
                  {isWorkloadEditorSupported && (
                    <Box display="flex">
                      <Tooltip title={createDisabledReason}>
                        <span>
                          <Button
                            variant="contained"
                            color="primary"
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={onConfigureWorkload}
                            disabled={!canCreate || readiness.loading}
                          >
                            Create release
                          </Button>
                        </span>
                      </Tooltip>
                    </Box>
                  )}
                </Box>

                <Divider style={{ margin: '12px 0' }} />

                {/* Story 2 — Deploy */}
                <DeployReleasePanel
                  releases={releases}
                  releasesLoading={releasesLoading}
                  releasesError={releasesError}
                  deployments={deployments}
                  selectedReleaseName={selectedReleaseName}
                  onSelectedReleaseChange={setSelectedReleaseName}
                  firstEnvironmentName={lowestEnvironment}
                  disabled={permissionLoading || !canConfigureAndDeploy}
                  disabledReason={deniedTooltip}
                />
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
