import { useEffect, useState } from 'react';
import { Box, Button, Tooltip, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { Alert } from '@material-ui/lab';
import SettingsOutlinedIcon from '@material-ui/icons/SettingsOutlined';
import type { ComponentRelease } from '@openchoreo/backstage-plugin-common';
import { useEnvironmentRouting } from '../hooks/useEnvironmentRouting';
import { ReleaseSelect } from './ReleaseSelect';
import type { ReleaseDeployments } from './releaseFormatters';
import { ReleaseBrowserDialog } from './ReleaseBrowserDialog';

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
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
    padding: theme.spacing(2),
    border: `1px dashed ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
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
  /** Forwarded to ReleaseSelect's footer "+ New release" action. */
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

  // Preselect the most recent release when nothing is selected yet, and
  // re-snap to the newest if the current selection no longer exists in the
  // releases list (e.g. the release was deleted upstream between refetches).
  // Skip while loading so a transient empty list doesn't clear a valid
  // selection.
  const newestName = releases[0]?.metadata?.name ?? null;
  const selectedExists =
    !!selectedReleaseName &&
    releases.some(r => r.metadata?.name === selectedReleaseName);
  useEffect(() => {
    if (releasesLoading) return;
    if (!selectedReleaseName && newestName) {
      onSelectedReleaseChange(newestName);
      return;
    }
    if (selectedReleaseName && !selectedExists) {
      onSelectedReleaseChange(newestName);
    }
  }, [
    releasesLoading,
    newestName,
    selectedReleaseName,
    selectedExists,
    onSelectedReleaseChange,
  ]);

  const handleDeploy = () => {
    if (!selectedReleaseName || !selectedExists) return;
    navigateToOverrides(firstEnvironmentName, {
      type: 'deploy',
      releaseName: selectedReleaseName,
      targetEnvironment: firstEnvironmentName,
    });
  };

  const noReleases = !releasesLoading && releases.length === 0;

  // First-component-ever case: with zero releases the dropdown becomes a
  // dead end (input disabled, footer actions unreachable inside its
  // popper). Surface an inline empty state with a prominent
  // "Create release" CTA instead — mirroring the auto-deploy ON empty
  // state's voice + the "Configure & deploy" button affordance.
  if (noReleases) {
    return (
      <Box className={classes.panel}>
        <Typography variant="subtitle2">Deploy</Typography>
        <Typography variant="caption" color="textSecondary">
          Pick a release and deploy it to {firstEnvironmentName}.
        </Typography>
        {releasesError && <Alert severity="error">{releasesError}</Alert>}
        <Box className={classes.emptyState}>
          <Typography variant="body2" color="textSecondary">
            No releases yet. Create your first release to deploy to{' '}
            {firstEnvironmentName}.
          </Typography>
          {onCreateRelease && (
            <Tooltip title={canCreateRelease ? '' : createDisabledReason ?? ''}>
              <span>
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  startIcon={<SettingsOutlinedIcon />}
                  onClick={onCreateRelease}
                  disabled={!canCreateRelease}
                >
                  Create release
                </Button>
              </span>
            </Tooltip>
          )}
        </Box>
      </Box>
    );
  }

  // `deployments` keeps env names in their original casing (e.g. "Development")
  // while `firstEnvironmentName` is lowercased upstream, so compare loosely.
  const targetEnv = firstEnvironmentName.toLowerCase();
  const alreadyDeployed =
    selectedExists &&
    (deployments[selectedReleaseName!] ?? []).some(
      e => e.toLowerCase() === targetEnv,
    );
  const deployDisabled =
    disabled ||
    !selectedReleaseName ||
    !selectedExists ||
    noReleases ||
    alreadyDeployed;

  const getTooltip = () => {
    if (disabled && disabledReason) return disabledReason;
    if (!selectedReleaseName) return 'Pick a release first';
    if (!selectedExists) return 'The selected release is no longer available.';
    if (alreadyDeployed) {
      return `This release is already deployed to ${firstEnvironmentName}.`;
    }
    return '';
  };

  return (
    <Box className={classes.panel}>
      <Typography variant="subtitle2">Deploy</Typography>
      <Typography variant="caption" color="textSecondary">
        Pick a release and deploy it to {firstEnvironmentName}.
      </Typography>

      {releasesError && <Alert severity="error">{releasesError}</Alert>}

      <ReleaseSelect
        releases={releases}
        selectedReleaseName={selectedReleaseName}
        onSelectedReleaseChange={onSelectedReleaseChange}
        deployments={deployments}
        firstEnvironmentName={firstEnvironmentName}
        loading={releasesLoading}
        onCreateRelease={onCreateRelease}
        canCreateRelease={canCreateRelease}
        createDisabledReason={createDisabledReason}
        onOpenReleaseBrowser={() => setBrowserOpen(true)}
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
