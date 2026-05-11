import { useCallback, useEffect, useMemo, useState } from 'react';
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
import CloseIcon from '@material-ui/icons/Close';
import EditOutlinedIcon from '@material-ui/icons/EditOutlined';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import SettingsOutlinedIcon from '@material-ui/icons/SettingsOutlined';
import { useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useEnvironmentDetailPanelStyles } from '../styles';
import { LoadingSkeleton } from './LoadingSkeleton';
import { AutoDeployConfirmationDialog } from './AutoDeployConfirmationDialog';
import { CreateReleaseDialog } from './CreateReleaseDialog';
import { DeployReleasePanel } from './DeployReleasePanel';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { useAutoDeployUpdate } from '../hooks/useAutoDeployUpdate';
import { useReleases } from '../hooks/useReleases';
import { useReleaseReadiness } from '../hooks/useReleaseReadiness';
import { useEnvironmentsContext } from '../EnvironmentsContext';
import { useConfigureAndDeployPermission } from '@openchoreo/backstage-plugin-react';
import { useNotification } from '../../../hooks';
import type { ReleaseDeployments } from './ReleasePicker';

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
  const client = useApi(openChoreoClientApiRef);
  const notification = useNotification();
  const { environments, lowestEnvironment } = useEnvironmentsContext();
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
    refetch: refetchReleases,
  } = useReleases(entity);

  const [autoDeploy, setAutoDeploy] = useState<boolean | undefined>(undefined);
  const [autoDeployLoaded, setAutoDeployLoaded] = useState(false);
  const [showAutoDeployConfirm, setShowAutoDeployConfirm] = useState(false);
  const [pendingAutoDeployValue, setPendingAutoDeployValue] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedReleaseName, setSelectedReleaseName] = useState<string | null>(
    null,
  );

  // Fetch auto-deploy from component details (same pattern as before).
  useEffect(() => {
    let cancelled = false;
    setAutoDeployLoaded(false);
    const load = async () => {
      try {
        const componentData = await client.getComponentDetails(entity);
        if (!cancelled && componentData?.autoDeploy !== undefined) {
          setAutoDeploy(componentData.autoDeploy);
        }
      } catch {
        // Leave undefined; toggle renders unchecked.
      } finally {
        if (!cancelled) setAutoDeployLoaded(true);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [entity, client]);

  const handleAutoDeployChange = useCallback(
    async (next: boolean) => {
      const ok = await updateAutoDeploy(next);
      if (ok) {
        setAutoDeploy(next);
        notification.showSuccess(
          `Auto deploy ${next ? 'enabled' : 'disabled'} successfully`,
        );
      } else {
        notification.showError('Failed to update auto deploy setting');
      }
    },
    [updateAutoDeploy, notification],
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

  const handleReleaseCreated = (releaseName: string) => {
    setCreateDialogOpen(false);
    notification.showSuccess(`Created release ${releaseName}`);
    setSelectedReleaseName(releaseName);
    refetchReleases();
  };

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
        {loading && !environmentsExist ? (
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
                    disabled={!autoDeployLoaded || autoDeployUpdating}
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

            {/* Story 1 — Release */}
            <Box display="flex" flexDirection="column" gridGap={8}>
              <Typography variant="subtitle2">Release</Typography>
              {readiness.alertMessage && (
                <Alert severity={readiness.alertSeverity}>
                  {readiness.alertMessage}
                </Alert>
              )}
              <Box display="flex" gridGap={8} flexWrap="wrap">
                <Tooltip title={createDisabledReason}>
                  <span>
                    <Button
                      variant="contained"
                      color="primary"
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => setCreateDialogOpen(true)}
                      disabled={!canCreate || readiness.loading}
                    >
                      Create release
                    </Button>
                  </span>
                </Tooltip>
                {isWorkloadEditorSupported && (
                  <Tooltip title={deniedTooltip}>
                    <span>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<EditOutlinedIcon />}
                        onClick={onConfigureWorkload}
                        disabled={permissionLoading || !canConfigureAndDeploy}
                      >
                        Edit workload
                      </Button>
                    </span>
                  </Tooltip>
                )}
              </Box>
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
              onDeployed={refetchReleases}
              disabled={permissionLoading || !canConfigureAndDeploy}
              disabledReason={deniedTooltip}
            />
          </>
        )}
      </Box>

      <CreateReleaseDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onCreated={handleReleaseCreated}
        existingReleases={releases}
        autoDeployEnabled={autoDeploy ?? false}
        firstEnvironmentName={lowestEnvironment}
      />

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
