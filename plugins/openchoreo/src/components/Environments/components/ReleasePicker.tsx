import { useMemo, useState } from 'react';
import { Box, Button, Chip, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { Skeleton } from '@material-ui/lab';
import type { ComponentRelease } from '@openchoreo/backstage-plugin-common';
import { ReleaseBrowserDialog } from './ReleaseBrowserDialog';

const useStyles = makeStyles(theme => ({
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  },
  label: {
    color: theme.palette.text.secondary,
    fontWeight: 600,
    fontSize: 11,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    marginBottom: theme.spacing(0.5),
  },
  summaryRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.75),
    padding: theme.spacing(1.25, 1.5),
    backgroundColor: theme.palette.action.hover,
    borderRadius: 6,
  },
  topLine: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1.5),
  },
  name: {
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flexGrow: 1,
    minWidth: 0,
  },
  meta: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(0.75),
  },
  chip: {
    height: 20,
    fontSize: 11,
  },
  empty: {
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
  },
}));

/** Map from releaseName → list of environment names where it is currently bound. */
export type ReleaseDeployments = Record<string, string[]>;

export interface ReleasePickerProps {
  releases: ComponentRelease[];
  selectedReleaseName: string | null;
  onChange: (releaseName: string | null) => void;
  /** Environments where each release is currently deployed. Used for badges. */
  deployments?: ReleaseDeployments;
  /** Env name passed to the browser dialog for context. */
  environmentName: string;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
}

const formatRelativeTime = (iso?: string): string => {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString();
};

const extractImage = (release: ComponentRelease): string | undefined => {
  const workload = release.spec?.workload as
    | { container?: { image?: string } }
    | undefined;
  return workload?.container?.image;
};

const shortenImage = (image: string): string => {
  const lastSlash = image.lastIndexOf('/');
  return lastSlash >= 0 ? image.slice(lastSlash + 1) : image;
};

export const ReleasePicker = ({
  releases,
  selectedReleaseName,
  onChange,
  deployments = {},
  environmentName,
  disabled,
  loading,
  label = 'Selected release',
}: ReleasePickerProps) => {
  const classes = useStyles();
  const [dialogOpen, setDialogOpen] = useState(false);

  const selected = useMemo(
    () => releases.find(r => r.metadata?.name === selectedReleaseName) ?? null,
    [releases, selectedReleaseName],
  );

  const noReleases = !loading && releases.length === 0;
  const created = selected
    ? formatRelativeTime(selected.metadata?.creationTimestamp)
    : '';
  const image = selected ? extractImage(selected) : undefined;
  const deployedIn = selected
    ? deployments[selected.metadata?.name ?? ''] ?? []
    : [];

  return (
    <Box className={classes.wrapper}>
      <Typography variant="caption" className={classes.label}>
        {label}
      </Typography>

      {loading ? (
        <Skeleton variant="rect" height={36} />
      ) : (
        <Box className={classes.summaryRow}>
          <Box className={classes.topLine}>
            {selected ? (
              <Typography variant="body2" className={classes.name}>
                {selected.metadata?.name}
              </Typography>
            ) : (
              <Typography variant="body2" className={classes.empty}>
                {noReleases ? 'No releases yet' : 'No release selected'}
              </Typography>
            )}
            <Button
              variant="outlined"
              size="small"
              onClick={() => setDialogOpen(true)}
              disabled={disabled || noReleases}
            >
              {selected ? 'Change' : 'Select release'}
            </Button>
          </Box>
          {selected && (
            <Box className={classes.meta}>
              {created && <span>{created}</span>}
              {image && <span>img: {shortenImage(image)}</span>}
              {deployedIn.map(env => (
                <Chip
                  key={env}
                  label={`current in ${env}`}
                  size="small"
                  color="primary"
                  className={classes.chip}
                />
              ))}
            </Box>
          )}
        </Box>
      )}

      <ReleaseBrowserDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        releases={releases}
        deployments={deployments}
        selectedReleaseName={selectedReleaseName}
        onConfirm={name => onChange(name)}
        environmentName={environmentName}
        loading={loading}
      />
    </Box>
  );
};
