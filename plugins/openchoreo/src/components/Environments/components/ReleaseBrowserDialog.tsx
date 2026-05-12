import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  TextField,
  Tooltip,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import CloseIcon from '@material-ui/icons/Close';
import FileCopyOutlinedIcon from '@material-ui/icons/FileCopyOutlined';
import SearchIcon from '@material-ui/icons/Search';
import { useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { YamlViewer } from '@openchoreo/backstage-design-system';
import YAML from 'yaml';
import type { ComponentRelease } from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import type { ReleaseDeployments } from './ReleasePicker';

const useStyles = makeStyles(theme => ({
  titleBar: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    paddingRight: theme.spacing(1),
  },
  titleText: {
    flexShrink: 0,
  },
  searchField: {
    flexGrow: 1,
    maxWidth: 320,
  },
  closeBtn: {
    marginLeft: 'auto',
  },
  content: {
    display: 'flex',
    padding: 0,
    height: '60vh',
    minHeight: 360,
  },
  listPane: {
    width: '38%',
    minWidth: 260,
    borderRight: `1px solid ${theme.palette.divider}`,
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  countLine: {
    padding: theme.spacing(1, 2),
    color: theme.palette.text.secondary,
    fontSize: 12,
  },
  detailPane: {
    flexGrow: 1,
    overflow: 'auto',
    padding: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  listItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(0.5),
  },
  listItemName: {
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    width: '100%',
  },
  listItemMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    color: theme.palette.text.secondary,
    fontSize: 12,
  },
  chip: {
    height: 20,
    fontSize: 11,
  },
  detailHeader: {
    display: 'flex',
    alignItems: 'baseline',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    columnGap: theme.spacing(2),
    rowGap: theme.spacing(0.5),
    fontSize: 13,
  },
  metaKey: {
    color: theme.palette.text.secondary,
  },
  yamlHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing(1),
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: theme.palette.text.secondary,
    gap: theme.spacing(1),
    padding: theme.spacing(3),
    textAlign: 'center',
  },
  yamlLoading: {
    display: 'flex',
    justifyContent: 'center',
    padding: theme.spacing(3),
  },
  yamlError: {
    color: theme.palette.error.main,
  },
}));

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

const formatAbsoluteTime = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
};

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

export interface ReleaseBrowserDialogProps {
  open: boolean;
  onClose: () => void;
  releases: ComponentRelease[];
  /** Map releaseName → environments where it is currently bound. */
  deployments: ReleaseDeployments;
  /** Currently committed selection (used as the initial highlight). */
  selectedReleaseName: string | null;
  onConfirm: (releaseName: string) => void;
  /** Env name for context in the title (e.g. "development"). */
  environmentName: string;
  /** Suppress the list while parent is fetching. */
  loading?: boolean;
  /**
   * When true, render as an inspector — no Select button. Used under
   * auto-deploy where the user cannot pick a release.
   */
  readOnly?: boolean;
}

interface ManifestState {
  yaml?: string;
  error?: string;
}

export const ReleaseBrowserDialog = ({
  open,
  onClose,
  releases,
  deployments,
  selectedReleaseName,
  onConfirm,
  environmentName,
  loading,
  readOnly,
}: ReleaseBrowserDialogProps) => {
  const classes = useStyles();
  const api = useApi(openChoreoClientApiRef);
  const { entity } = useEntity();

  const [query, setQuery] = useState('');
  const [highlightedName, setHighlightedName] = useState<string | null>(null);
  const [manifestCache, setManifestCache] = useState<
    Record<string, ManifestState>
  >({});
  const [yamlLoading, setYamlLoading] = useState(false);

  // Reset internal state every time the dialog opens so backing out and
  // reopening doesn't preserve a stale browse position.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    const fallback = selectedReleaseName ?? releases[0]?.metadata?.name ?? null;
    setHighlightedName(fallback);
  }, [open, selectedReleaseName, releases]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return releases;
    return releases.filter(r => {
      const name = r.metadata?.name?.toLowerCase() ?? '';
      const image = extractImage(r)?.toLowerCase() ?? '';
      const envs = (deployments[r.metadata?.name ?? ''] ?? [])
        .join(' ')
        .toLowerCase();
      return name.includes(q) || image.includes(q) || envs.includes(q);
    });
  }, [releases, deployments, query]);

  const highlighted = useMemo(
    () => releases.find(r => r.metadata?.name === highlightedName) ?? null,
    [releases, highlightedName],
  );

  // Fetch the manifest for the highlighted release once.
  useEffect(() => {
    if (!open || !highlightedName) return undefined;
    if (manifestCache[highlightedName]) return undefined;
    let cancelled = false;
    setYamlLoading(true);
    api
      .fetchComponentRelease(entity, highlightedName)
      .then(response => {
        if (cancelled) return;
        if (!response?.success || !response.data) {
          setManifestCache(prev => ({
            ...prev,
            [highlightedName]: { error: 'Release manifest is not available.' },
          }));
          return;
        }
        setManifestCache(prev => ({
          ...prev,
          [highlightedName]: { yaml: YAML.stringify(response.data) },
        }));
      })
      .catch(e => {
        if (cancelled) return;
        setManifestCache(prev => ({
          ...prev,
          [highlightedName]: {
            error: e?.message ?? 'Failed to fetch release manifest',
          },
        }));
      })
      .finally(() => {
        if (!cancelled) setYamlLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, entity, open, highlightedName, manifestCache]);

  const handleConfirm = () => {
    if (!highlightedName) return;
    onConfirm(highlightedName);
    onClose();
  };

  const handleCopy = async () => {
    const yamlText = highlightedName && manifestCache[highlightedName]?.yaml;
    if (!yamlText) return;
    try {
      await navigator.clipboard.writeText(yamlText);
    } catch {
      // Best-effort — clipboard access may be unavailable.
    }
  };

  const noReleases = !loading && releases.length === 0;
  const currentManifest = highlightedName
    ? manifestCache[highlightedName]
    : undefined;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle disableTypography>
        <Box className={classes.titleBar}>
          <Typography variant="h6" className={classes.titleText}>
            {readOnly ? 'Releases' : 'Select release'}
          </Typography>
          <TextField
            className={classes.searchField}
            size="small"
            variant="outlined"
            placeholder="Search by name, image, or env"
            value={query}
            onChange={e => setQuery(e.target.value)}
            disabled={noReleases}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <IconButton
            size="small"
            onClick={onClose}
            aria-label="Close"
            className={classes.closeBtn}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers className={classes.content}>
        {noReleases ? (
          <Box className={classes.empty}>
            <Typography variant="subtitle1">No releases yet</Typography>
            <Typography variant="body2">
              Create a release to deploy it to {environmentName}.
            </Typography>
          </Box>
        ) : (
          <>
            <Box className={classes.listPane}>
              <Typography className={classes.countLine}>
                Showing {filtered.length} of {releases.length}
              </Typography>
              <List dense disablePadding>
                {filtered.map(release => {
                  const name = release.metadata?.name ?? '(unnamed)';
                  const created = formatRelativeTime(
                    release.metadata?.creationTimestamp,
                  );
                  const image = extractImage(release);
                  const deployedIn = deployments[name] ?? [];
                  return (
                    <ListItem
                      key={name}
                      button
                      selected={highlightedName === name}
                      onClick={() => setHighlightedName(name)}
                      onDoubleClick={() => {
                        if (readOnly) {
                          setHighlightedName(name);
                          return;
                        }
                        setHighlightedName(name);
                        onConfirm(name);
                        onClose();
                      }}
                      data-testid={`release-row-${name}`}
                    >
                      <ListItemText
                        disableTypography
                        primary={
                          <Box className={classes.listItem}>
                            <Typography
                              className={classes.listItemName}
                              variant="body2"
                            >
                              {name}
                            </Typography>
                            <Box className={classes.listItemMeta}>
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
                          </Box>
                        }
                      />
                    </ListItem>
                  );
                })}
                {filtered.length === 0 && (
                  <Box p={2}>
                    <Typography variant="body2" color="textSecondary">
                      No matches.
                    </Typography>
                  </Box>
                )}
              </List>
            </Box>

            <Box className={classes.detailPane}>
              {highlighted ? (
                <>
                  <Box className={classes.detailHeader}>
                    <Typography variant="h6">
                      {highlighted.metadata?.name}
                    </Typography>
                    {(deployments[highlighted.metadata?.name ?? ''] ?? []).map(
                      env => (
                        <Chip
                          key={env}
                          label={`current in ${env}`}
                          size="small"
                          color="primary"
                          className={classes.chip}
                        />
                      ),
                    )}
                  </Box>

                  <Box className={classes.metaGrid}>
                    <span className={classes.metaKey}>Created</span>
                    <span>
                      {formatAbsoluteTime(
                        highlighted.metadata?.creationTimestamp,
                      )}{' '}
                      (
                      {formatRelativeTime(
                        highlighted.metadata?.creationTimestamp,
                      )}
                      )
                    </span>
                    {extractImage(highlighted) && (
                      <>
                        <span className={classes.metaKey}>Image</span>
                        <span>{extractImage(highlighted)}</span>
                      </>
                    )}
                  </Box>

                  <Box className={classes.yamlHeader}>
                    <Typography variant="subtitle2">Manifest</Typography>
                    <Tooltip title="Copy YAML">
                      <span>
                        <Button
                          size="small"
                          startIcon={<FileCopyOutlinedIcon />}
                          onClick={handleCopy}
                          disabled={!currentManifest?.yaml}
                        >
                          Copy
                        </Button>
                      </span>
                    </Tooltip>
                  </Box>
                  {yamlLoading && !currentManifest && (
                    <Box className={classes.yamlLoading}>
                      <CircularProgress size={24} />
                    </Box>
                  )}
                  {currentManifest?.error && (
                    <Typography
                      variant="body2"
                      className={classes.yamlError}
                      data-testid="yaml-error"
                    >
                      {currentManifest.error}
                    </Typography>
                  )}
                  {currentManifest?.yaml && (
                    <YamlViewer
                      value={currentManifest.yaml}
                      maxHeight="40vh"
                      showLineNumbers
                    />
                  )}
                </>
              ) : (
                <Box className={classes.empty}>
                  <Typography variant="body2">
                    Pick a release on the left to see details.
                  </Typography>
                </Box>
              )}
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</Button>
        {!readOnly && (
          <Button
            variant="contained"
            color="primary"
            onClick={handleConfirm}
            disabled={!highlightedName || noReleases}
          >
            Select
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
