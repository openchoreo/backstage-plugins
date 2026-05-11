import { useMemo, useState } from 'react';
import {
  Box,
  Chip,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { Autocomplete } from '@material-ui/lab';
import VisibilityOutlinedIcon from '@material-ui/icons/VisibilityOutlined';
import type { ComponentRelease } from '@openchoreo/backstage-plugin-common';
import { ReleaseManifestDialog } from './ReleaseManifestDialog';

const useStyles = makeStyles(theme => ({
  optionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    width: '100%',
  },
  optionMain: {
    flexGrow: 1,
    minWidth: 0,
  },
  optionName: {
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  optionMeta: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
  currentChip: {
    height: 20,
    fontSize: 11,
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
  /** Env name passed to the YAML preview dialog. */
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

/** Pull `spec.workload.spec.container.image` (or any reasonable fallback) for display. */
const extractImage = (release: ComponentRelease): string | undefined => {
  const workload = release.spec?.workload as
    | { spec?: { container?: { image?: string } } }
    | undefined;
  return workload?.spec?.container?.image;
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
  label = 'Release',
}: ReleasePickerProps) => {
  const classes = useStyles();
  const [yamlReleaseName, setYamlReleaseName] = useState<string | null>(null);

  const selected = useMemo(
    () => releases.find(r => r.metadata?.name === selectedReleaseName) ?? null,
    [releases, selectedReleaseName],
  );

  return (
    <>
      <Autocomplete
        options={releases}
        value={selected}
        onChange={(_, next) => onChange(next?.metadata?.name ?? null)}
        getOptionLabel={r => r.metadata?.name ?? ''}
        getOptionSelected={(opt, val) =>
          opt.metadata?.name === val.metadata?.name
        }
        disabled={disabled}
        loading={loading}
        renderInput={params => (
          <TextField
            {...params}
            label={label}
            variant="outlined"
            size="small"
            placeholder={loading ? 'Loading releases...' : 'Search releases'}
          />
        )}
        renderOption={release => {
          const name = release.metadata?.name ?? '(unnamed)';
          const created = formatRelativeTime(
            release.metadata?.creationTimestamp,
          );
          const image = extractImage(release);
          const deployedIn = deployments[name] ?? [];
          return (
            <Box className={classes.optionRow}>
              <Box className={classes.optionMain}>
                <Typography className={classes.optionName} variant="body2">
                  {name}
                </Typography>
                <Box className={classes.optionMeta}>
                  {created && <span>{created}</span>}
                  {image && <span>img: {shortenImage(image)}</span>}
                  {deployedIn.map(env => (
                    <Chip
                      key={env}
                      label={`current in ${env}`}
                      size="small"
                      color="primary"
                      className={classes.currentChip}
                    />
                  ))}
                </Box>
              </Box>
              <Tooltip title="View release YAML">
                <IconButton
                  size="small"
                  onMouseDown={e => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  onClick={e => {
                    e.stopPropagation();
                    setYamlReleaseName(name);
                  }}
                  aria-label="View release YAML"
                >
                  <VisibilityOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          );
        }}
      />

      <ReleaseManifestDialog
        open={!!yamlReleaseName}
        onClose={() => setYamlReleaseName(null)}
        releaseName={yamlReleaseName ?? undefined}
        environmentName={environmentName}
      />
    </>
  );
};
