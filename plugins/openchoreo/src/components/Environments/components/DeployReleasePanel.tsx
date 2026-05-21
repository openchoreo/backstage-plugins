import { useEffect, useState } from 'react';
import { Box, Button, Tooltip, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { Alert } from '@material-ui/lab';
import AddIcon from '@material-ui/icons/Add';
import type { ComponentRelease } from '@openchoreo/backstage-plugin-common';
import { useEnvironmentRouting } from '../hooks/useEnvironmentRouting';
import { ReleasePicker, type ReleaseDeployments } from './ReleasePicker';
import { ReleaseBrowserDialog } from './ReleaseBrowserDialog';

const useStyles = makeStyles(theme => ({
  panel: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1.5),
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    flexShrink: 0,
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
  disabled?: boolean;
  disabledReason?: string;
  /** Forwarded to ReleasePicker to render an inline "+ Create release" button. */
  onCreateRelease?: () => void;
  canCreateRelease?: boolean;
  createDisabledReason?: string;
}

/**
 * Story 2: pick an existing release and deploy it to the first environment.
 *
 * The Deploy button always navigates to the existing /overrides/<env> page
 * with a 'deploy' pendingAction; that page reviews overrides and triggers
 * updateReleaseBinding on save. There is no "deploy without reviewing
 * overrides" shortcut — going through overrides is the canonical path.
 */
export const DeployReleasePanel = ({
  releases,
  releasesLoading,
  releasesError,
  deployments,
  selectedReleaseName,
  onSelectedReleaseChange,
  firstEnvironmentName,
  disabled,
  disabledReason,
  onCreateRelease,
  canCreateRelease,
  createDisabledReason,
}: DeployReleasePanelProps) => {
  const classes = useStyles();
  const { navigateToOverrides } = useEnvironmentRouting();
  const [browserOpen, setBrowserOpen] = useState(false);

  // Preselect the most recent release when nothing is selected yet. Only
  // react to the newest name changing so the user's explicit selection
  // survives refetches.
  const newestName = releases[0]?.metadata?.name ?? null;
  useEffect(() => {
    if (!selectedReleaseName && newestName) {
      onSelectedReleaseChange(newestName);
    }
  }, [newestName, selectedReleaseName, onSelectedReleaseChange]);

  const handleDeploy = () => {
    if (!selectedReleaseName) return;
    navigateToOverrides(firstEnvironmentName, {
      type: 'deploy',
      releaseName: selectedReleaseName,
      targetEnvironment: firstEnvironmentName,
    });
  };

  const noReleases = !releasesLoading && releases.length === 0;
  // `deployments` keeps env names in their original casing (e.g. "Development")
  // while `firstEnvironmentName` is lowercased upstream, so compare loosely.
  const targetEnv = firstEnvironmentName.toLowerCase();
  const alreadyDeployed =
    !!selectedReleaseName &&
    (deployments[selectedReleaseName] ?? []).some(
      e => e.toLowerCase() === targetEnv,
    );
  const deployDisabled =
    disabled || !selectedReleaseName || noReleases || alreadyDeployed;

  const getTooltip = () => {
    if (disabled && disabledReason) return disabledReason;
    if (!selectedReleaseName) return 'Pick a release first';
    if (alreadyDeployed) {
      return `This release is already deployed to ${firstEnvironmentName}.`;
    }
    return '';
  };

  return (
    <Box className={classes.panel}>
      <Box className={classes.header}>
        <Typography variant="subtitle2">Deploy</Typography>
        <Box className={classes.headerActions}>
          {onCreateRelease && (
            <Tooltip title={createDisabledReason ?? ''}>
              <span>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={onCreateRelease}
                  disabled={!canCreateRelease}
                >
                  Create release
                </Button>
              </span>
            </Tooltip>
          )}
          {!(noReleases && onCreateRelease) && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => setBrowserOpen(true)}
              disabled={disabled || noReleases}
            >
              Select release
            </Button>
          )}
        </Box>
      </Box>
      <Typography variant="caption" color="textSecondary">
        Pick a release and deploy it to {firstEnvironmentName}.
      </Typography>

      {releasesError && <Alert severity="error">{releasesError}</Alert>}

      <ReleasePicker
        releases={releases}
        selectedReleaseName={selectedReleaseName}
        deployments={deployments}
        loading={releasesLoading}
      />

      <Box className={classes.actionsRow}>
        <Tooltip title={getTooltip()}>
          <span>
            <Button
              variant="contained"
              color="primary"
              size="small"
              onClick={handleDeploy}
              disabled={deployDisabled}
            >
              Deploy
            </Button>
          </span>
        </Tooltip>
      </Box>

      <ReleaseBrowserDialog
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
        releases={releases}
        deployments={deployments}
        selectedReleaseName={selectedReleaseName}
        onConfirm={name => onSelectedReleaseChange(name)}
        environmentName={firstEnvironmentName}
        loading={releasesLoading}
      />
    </Box>
  );
};
