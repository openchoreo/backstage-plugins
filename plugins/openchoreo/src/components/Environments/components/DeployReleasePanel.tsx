import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Tooltip,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { Alert } from '@material-ui/lab';
import TuneOutlinedIcon from '@material-ui/icons/TuneOutlined';
import { useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import type { ComponentRelease } from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { useNotification } from '../../../hooks';
import { getErrorMessage } from '../../../utils/errorUtils';
import { useEnvironmentsContext } from '../EnvironmentsContext';
import { useEnvironmentRouting } from '../hooks/useEnvironmentRouting';
import { ReleasePicker, type ReleaseDeployments } from './ReleasePicker';

const useStyles = makeStyles(theme => ({
  panel: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  actionsRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing(1),
  },
}));

export interface DeployReleasePanelProps {
  releases: ComponentRelease[];
  releasesLoading: boolean;
  releasesError: string | null;
  /** Map release name → environments where it is currently bound. */
  deployments: ReleaseDeployments;
  /** Externally controlled selection (so dialogs can preselect newly created release). */
  selectedReleaseName: string | null;
  onSelectedReleaseChange: (releaseName: string | null) => void;
  /** Display name of the first env (e.g. "development"). */
  firstEnvironmentName: string;
  /** Refetch releases + bindings after a successful deploy. */
  onDeployed: () => void;
  disabled?: boolean;
  disabledReason?: string;
}

/**
 * Story 2: pick an existing release and deploy it to the first environment.
 *
 * Deploy now    → calls updateReleaseBinding directly with no override payload
 *                 (release defaults apply).
 * Configure overrides → deep-links to the existing /overrides/<env> page with
 *                 a 'deploy' pendingAction. That page already saves overrides
 *                 and triggers updateReleaseBinding on save.
 */
export const DeployReleasePanel = ({
  releases,
  releasesLoading,
  releasesError,
  deployments,
  selectedReleaseName,
  onSelectedReleaseChange,
  firstEnvironmentName,
  onDeployed,
  disabled,
  disabledReason,
}: DeployReleasePanelProps) => {
  const classes = useStyles();
  const client = useApi(openChoreoClientApiRef);
  const { entity } = useEntity();
  const notification = useNotification();
  const { refetch } = useEnvironmentsContext();
  const { navigateToOverrides } = useEnvironmentRouting();

  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);

  // Preselect the most recent release when one is available and nothing is
  // selected yet. Only run when the list of names actually changes, so the
  // user's explicit selection survives refetches.
  const newestName = releases[0]?.metadata?.name ?? null;
  useEffect(() => {
    if (!selectedReleaseName && newestName) {
      onSelectedReleaseChange(newestName);
    }
  }, [newestName, selectedReleaseName, onSelectedReleaseChange]);

  const handleConfigureOverrides = () => {
    if (!selectedReleaseName) return;
    navigateToOverrides(firstEnvironmentName, {
      type: 'deploy',
      releaseName: selectedReleaseName,
      targetEnvironment: firstEnvironmentName,
    });
  };

  const handleDeployNow = async () => {
    if (!selectedReleaseName) return;
    setDeploying(true);
    setDeployError(null);
    try {
      await client.updateReleaseBinding(
        entity,
        firstEnvironmentName,
        selectedReleaseName,
      );
      notification.showSuccess(
        `Deployed ${selectedReleaseName} to ${firstEnvironmentName}`,
      );
      refetch();
      onDeployed();
    } catch (e: unknown) {
      setDeployError(getErrorMessage(e));
    } finally {
      setDeploying(false);
    }
  };

  const noReleases = !releasesLoading && releases.length === 0;
  const deployDisabled = useMemo(
    () => disabled || deploying || !selectedReleaseName || noReleases,
    [disabled, deploying, selectedReleaseName, noReleases],
  );

  return (
    <Box className={classes.panel}>
      <Typography variant="subtitle2">
        Deploy to {firstEnvironmentName}
      </Typography>

      {releasesError && <Alert severity="error">{releasesError}</Alert>}

      {noReleases && !releasesError && (
        <Alert severity="info">
          No releases yet. Create one above to deploy it here.
        </Alert>
      )}

      <ReleasePicker
        releases={releases}
        selectedReleaseName={selectedReleaseName}
        onChange={onSelectedReleaseChange}
        deployments={deployments}
        environmentName={firstEnvironmentName}
        loading={releasesLoading}
        disabled={disabled || noReleases}
      />

      {deployError && (
        <Alert severity="error" onClose={() => setDeployError(null)}>
          {deployError}
        </Alert>
      )}

      <Box className={classes.actionsRow}>
        <Tooltip
          title={
            !selectedReleaseName
              ? 'Pick a release first'
              : 'Edit per-environment overrides before deploying'
          }
        >
          <span>
            <Button
              variant="outlined"
              size="small"
              startIcon={<TuneOutlinedIcon />}
              onClick={handleConfigureOverrides}
              disabled={!selectedReleaseName || deploying || disabled}
            >
              Configure overrides
            </Button>
          </span>
        </Tooltip>
        <Tooltip title={deployDisabled && disabledReason ? disabledReason : ''}>
          <span>
            <Button
              variant="contained"
              color="primary"
              size="small"
              onClick={handleDeployNow}
              disabled={deployDisabled}
              startIcon={
                deploying ? (
                  <CircularProgress size={16} color="inherit" />
                ) : undefined
              }
            >
              {deploying ? 'Deploying...' : 'Deploy now'}
            </Button>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
};
