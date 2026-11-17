import { Fragment, type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
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
import {
  Autocomplete,
  ToggleButton,
  ToggleButtonGroup,
} from '@material-ui/lab';
import CloseIcon from '@material-ui/icons/Close';
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';
import FileCopyOutlinedIcon from '@material-ui/icons/FileCopyOutlined';
import SearchIcon from '@material-ui/icons/Search';
import { YamlViewer } from '@openchoreo/backstage-design-system';
import { YamlDiffViewer } from '@openchoreo/backstage-plugin-react';
import type { BindingRevision } from '@openchoreo/backstage-plugin-common';
import YAML from 'yaml';
import { formatRelativeTime } from './releaseFormatters';
import { DeployedEnvBadges } from './DeployedEnvBadges';
import {
  gapLabel,
  healthPill,
  isActive,
  isKnownGood,
  isReleaseAvailable,
  revisionAccessibleName,
  revisionName,
  revisionNumber,
  revisionGaps,
  revisionMessage,
  revisionReleaseName,
} from '../utils/revisionUtils';

// Styles follow ReleaseBrowserDialog so both browsers look the same.
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
  releaseGone: {
    textDecoration: 'line-through',
  },
  gapItem: {
    opacity: 0.6,
    fontStyle: 'italic',
  },
  footerStart: {
    marginRight: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  // Same look as the "Remove deployment" button in the danger zone.
  deleteButton: {
    color: theme.palette.error.main,
    borderColor: theme.palette.error.main,
    '&:hover': {
      borderColor: theme.palette.error.dark,
      backgroundColor: theme.palette.action.hover,
    },
  },
  listItemMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    color: theme.palette.text.secondary,
    fontSize: 12,
  },
  detailHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  detailHeaderTitle: {
    display: 'flex',
    alignItems: 'baseline',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
    minWidth: 0,
  },
  modeToggle: {
    flexShrink: 0,
  },
  modeButton: {
    padding: theme.spacing(0.25, 1.25),
    fontSize: 12,
    lineHeight: 1.4,
    textTransform: 'none',
  },
  compareBar: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  compareLabel: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    flexShrink: 0,
  },
  compareSelector: {
    flexGrow: 1,
    minWidth: 0,
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
  message: {
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
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
}));

const formatAbsoluteTime = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
};

/** "6h ago · Healthy · Deploy", a revision's line under its name. */
const metaLine = (rev: BindingRevision): string =>
  [
    formatRelativeTime(rev.metadata.creationTimestamp),
    healthPill(rev.status?.health).label,
    rev.spec.cause,
  ]
    .filter(Boolean)
    .join(' · ');

/**
 * Search matches the revision name and number, release, cause, health and
 * change message.
 */
export const matchesRevision = (
  rev: BindingRevision,
  query: string,
): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  // "r6" names revision 6. Release names end in a hash full of digits, so
  // matching the bare number as a substring would also hit unrelated ones.
  const number = /^r(\d+)$/.exec(q);
  if (number) return revisionNumber(rev) === Number(number[1]);
  return [
    String(revisionNumber(rev)),
    revisionName(rev),
    revisionReleaseName(rev),
    rev.spec.cause,
    revisionMessage(rev) ?? '',
    healthPill(rev.status?.health).label,
    isActive(rev) ? 'active' : '',
    isKnownGood(rev) ? 'known-good known good' : '',
  ].some(field => field.toLowerCase().includes(q));
};

/**
 * The full revision object (ReleaseBindingRevision or
 * ResourceReleaseBindingRevision) as YAML, as kubectl would show it:
 * apiVersion, kind, metadata, spec and status. Server-side bookkeeping
 * (managedFields) is left out.
 */
export const revisionYaml = (rev: BindingRevision): string => {
  const { managedFields: _managed, ...metadata } = rev.metadata as Record<
    string,
    unknown
  >;
  return YAML.stringify({
    apiVersion:
      (rev as { apiVersion?: string }).apiVersion ?? 'openchoreo.dev/v1alpha1',
    kind:
      (rev as { kind?: string }).kind ??
      ('resourceReleaseName' in rev.spec
        ? 'ResourceReleaseBindingRevision'
        : 'ReleaseBindingRevision'),
    metadata,
    spec: rev.spec,
    ...(rev.status ? { status: rev.status } : {}),
  });
};

export interface RevisionBrowserDialogProps {
  open: boolean;
  onClose: () => void;
  /** Revisions newest first. */
  revisions: BindingRevision[];
  environmentName: string;
  /** Names of releases that still exist; null while unknown. */
  releaseNames: ReadonlySet<string> | null;
  /** Revision to highlight first; defaults to the newest. */
  initialRevisionName?: string | null;
  /** Why the rollback to a revision is blocked, or null when allowed. */
  rollbackBlockedReason: (rev: BindingRevision) => string | null;
  onRollback: (rev: BindingRevision) => void;
  /**
   * Why deleting a revision is blocked, or null when allowed. With onDelete,
   * the footer offers to delete the highlighted revision.
   */
  deleteBlockedReason?: (rev: BindingRevision) => string | null;
  onDelete?: (rev: BindingRevision) => void;
  /**
   * The control that shows and changes the binding's revision history limit,
   * placed in the footer after Delete.
   */
  historyLimitControl?: ReactNode;
}

/**
 * Browses a binding's revisions the way ReleaseBrowserDialog browses
 * releases: a searchable list on the left; on the right the highlighted
 * revision's details with a View tab (its full revision object as YAML)
 * and a Compare tab (a side-by-side diff against another revision, the
 * active one by default). The footer rolls back to the highlighted revision,
 * or deletes it, and holds the binding's revision history limit. Numbers missing from the history -- revisions deleted, or
 * removed by the history limit -- are listed as unavailable, never as
 * revisions: nothing of them is kept.
 */
export const RevisionBrowserDialog = ({
  open,
  onClose,
  revisions,
  environmentName,
  releaseNames,
  initialRevisionName,
  rollbackBlockedReason,
  onRollback,
  deleteBlockedReason,
  onDelete,
  historyLimitControl,
}: RevisionBrowserDialogProps) => {
  const classes = useStyles();
  const [query, setQuery] = useState('');
  const [highlightedName, setHighlightedName] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'compare'>('view');
  const [compareTargetName, setCompareTargetName] = useState<string | null>(
    null,
  );

  const active = revisions.find(isActive) ?? null;

  // Reset every time the dialog opens so a reopened browser starts from the
  // panel's selection rather than a stale position.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setHighlightedName(
      revisions.find(r => r.metadata.name === initialRevisionName)?.metadata
        .name ??
        revisions[0]?.metadata.name ??
        null,
    );
    setMode('view');
    setCompareTargetName(null);
    // Only on open: later list refreshes must not move the user's position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Entering Compare for the first time compares with the active revision,
  // unless the highlighted revision is the active one. Highlighting the
  // revision being compared with clears it: a revision is never compared with
  // itself.
  useEffect(() => {
    if (mode !== 'compare') return;
    if (compareTargetName && compareTargetName === highlightedName) {
      setCompareTargetName(null);
      return;
    }
    if (compareTargetName) return;
    if (active && active.metadata.name !== highlightedName) {
      setCompareTargetName(active.metadata.name);
    }
  }, [mode, compareTargetName, active, highlightedName]);

  const filtered = useMemo(
    () => revisions.filter(r => matchesRevision(r, query)),
    [revisions, query],
  );

  const highlighted =
    revisions.find(r => r.metadata.name === highlightedName) ?? null;
  const compareTarget =
    compareTargetName !== highlightedName
      ? revisions.find(r => r.metadata.name === compareTargetName) ?? null
      : null;
  const highlightedYaml = highlighted ? revisionYaml(highlighted) : '';
  const blocked = highlighted ? rollbackBlockedReason(highlighted) : null;
  const deleteBlocked =
    highlighted && deleteBlockedReason
      ? deleteBlockedReason(highlighted)
      : null;
  // The highlighted revision was deleted while the browser was open.
  const highlightedGone = highlightedName !== null && !highlighted;
  // Gaps are only meaningful in the whole, unfiltered history.
  const gaps = useMemo(
    () => (query ? new Map() : revisionGaps(revisions)),
    [revisions, query],
  );

  type CompareOption = {
    name: string;
    group: 'Currently active' | 'Other revisions';
    label: string;
    sublabel?: string;
  };
  const compareOptions = useMemo<CompareOption[]>(
    () =>
      revisions
        .filter(r => r.metadata.name !== highlightedName)
        .map(r => ({
          name: r.metadata.name,
          group: isActive(r)
            ? ('Currently active' as const)
            : ('Other revisions' as const),
          label: isActive(r) ? `Active in ${environmentName}` : revisionName(r),
          sublabel: isActive(r) ? revisionName(r) : metaLine(r),
        }))
        .sort((a, b) => {
          if (a.group === b.group) return 0;
          return a.group === 'Currently active' ? -1 : 1;
        }),
    [revisions, highlightedName, environmentName],
  );
  const selectedCompareOption =
    compareOptions.find(o => o.name === compareTargetName) ?? null;

  const handleCopy = async () => {
    if (!highlightedYaml) return;
    try {
      await navigator.clipboard.writeText(highlightedYaml);
    } catch {
      // Best-effort — clipboard access may be unavailable.
    }
  };

  const noRevisions = revisions.length === 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      aria-labelledby="revision-browser-dialog-title"
    >
      <DialogTitle disableTypography id="revision-browser-dialog-title">
        <Box className={classes.titleBar}>
          <Typography variant="h6" className={classes.titleText}>
            Select revision
          </Typography>
          <TextField
            className={classes.searchField}
            size="small"
            variant="outlined"
            placeholder="Search by name, release, cause, health, or message"
            value={query}
            onChange={e => setQuery(e.target.value)}
            disabled={noRevisions}
            inputProps={{ 'aria-label': 'Search revisions' }}
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
        {noRevisions ? (
          <Box className={classes.empty}>
            <Typography variant="subtitle1">No revisions yet</Typography>
            <Typography variant="body2">
              A revision is recorded each time {environmentName} gets a new
              spec.
            </Typography>
          </Box>
        ) : (
          <>
            <Box className={classes.listPane}>
              <Typography className={classes.countLine}>
                Showing {filtered.length} of {revisions.length}
              </Typography>
              <List dense disablePadding>
                {filtered.map(rev => {
                  const name = rev.metadata.name;
                  const gone = !isReleaseAvailable(rev, releaseNames);
                  const gap = gaps.get(revisionNumber(rev));
                  return (
                    <Fragment key={name}>
                      <ListItem
                        button
                        selected={highlightedName === name}
                        onClick={() => setHighlightedName(name)}
                        aria-label={revisionAccessibleName(rev)}
                        data-testid={`browser-revision-${revisionNumber(rev)}`}
                      >
                        <ListItemText
                          disableTypography
                          primary={
                            <Box className={classes.listItem}>
                              <Typography
                                className={`${classes.listItemName} ${
                                  gone ? classes.releaseGone : ''
                                }`}
                                variant="body2"
                              >
                                {revisionName(rev)}
                              </Typography>
                              <Box className={classes.listItemMeta}>
                                <span>{metaLine(rev)}</span>
                                {gone && <span>release deleted</span>}
                              </Box>
                              {isActive(rev) && (
                                <DeployedEnvBadges
                                  envs={[environmentName]}
                                  primaryEnv={environmentName}
                                />
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                      {gap && (
                        <ListItem
                          className={classes.gapItem}
                          aria-label={`${gapLabel(gap)} no longer available`}
                          data-testid={`browser-gap-${gap.from}`}
                        >
                          <ListItemText
                            disableTypography
                            primary={
                              <Box className={classes.listItem}>
                                <Typography
                                  className={`${classes.listItemName} ${classes.releaseGone}`}
                                  variant="body2"
                                >
                                  {gapLabel(gap)}
                                </Typography>
                                <Box className={classes.listItemMeta}>
                                  <span>
                                    Unavailable: deleted, or removed by the
                                    history limit
                                  </span>
                                </Box>
                              </Box>
                            }
                          />
                        </ListItem>
                      )}
                    </Fragment>
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
                    <Box className={classes.detailHeaderTitle}>
                      <Typography variant="h6">
                        {revisionName(highlighted)}
                      </Typography>
                      {isActive(highlighted) && (
                        <DeployedEnvBadges
                          envs={[environmentName]}
                          primaryEnv={environmentName}
                        />
                      )}
                    </Box>
                    <ToggleButtonGroup
                      size="small"
                      exclusive
                      value={mode}
                      onChange={(_, next) => {
                        if (next === 'view' || next === 'compare')
                          setMode(next);
                      }}
                      className={classes.modeToggle}
                      aria-label="Detail pane mode"
                    >
                      <ToggleButton
                        value="view"
                        className={classes.modeButton}
                        aria-label="View revision"
                      >
                        View
                      </ToggleButton>
                      <ToggleButton
                        value="compare"
                        className={classes.modeButton}
                        aria-label="Compare with another revision"
                      >
                        Compare
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </Box>

                  <Box className={classes.metaGrid}>
                    <span className={classes.metaKey}>Created</span>
                    <span>
                      {formatAbsoluteTime(
                        highlighted.metadata.creationTimestamp,
                      )}{' '}
                      (
                      {formatRelativeTime(
                        highlighted.metadata.creationTimestamp,
                      )}
                      )
                    </span>
                    <span className={classes.metaKey}>Release</span>
                    <span>{revisionReleaseName(highlighted)}</span>
                    <span className={classes.metaKey}>Cause</span>
                    <span>{highlighted.spec.cause}</span>
                    {revisionMessage(highlighted) && (
                      <>
                        <span className={classes.metaKey}>Message</span>
                        <span
                          className={classes.message}
                          data-testid="revision-message"
                        >
                          {revisionMessage(highlighted)}
                        </span>
                      </>
                    )}
                    <span className={classes.metaKey}>Health</span>
                    <span>
                      {healthPill(highlighted.status?.health).label}
                      {isKnownGood(highlighted) && ' · known good'}
                    </span>
                  </Box>

                  {mode === 'view' ? (
                    <>
                      <Box className={classes.yamlHeader}>
                        <Typography variant="subtitle2">Manifest</Typography>
                        <Tooltip title="Copy YAML">
                          <span>
                            <Button
                              size="small"
                              startIcon={<FileCopyOutlinedIcon />}
                              onClick={handleCopy}
                            >
                              Copy
                            </Button>
                          </span>
                        </Tooltip>
                      </Box>
                      <YamlViewer
                        value={highlightedYaml}
                        maxHeight="40vh"
                        showLineNumbers
                      />
                    </>
                  ) : (
                    <>
                      <Box className={classes.compareBar}>
                        <Typography
                          variant="body2"
                          className={classes.compareLabel}
                        >
                          Compare with
                        </Typography>
                        <Autocomplete<CompareOption, false, false, false>
                          className={classes.compareSelector}
                          size="small"
                          options={compareOptions}
                          value={selectedCompareOption}
                          getOptionLabel={o => o.label}
                          groupBy={o => o.group}
                          renderOption={o => (
                            <Box
                              display="flex"
                              flexDirection="column"
                              minWidth={0}
                            >
                              <Typography variant="body2">{o.label}</Typography>
                              {o.sublabel && (
                                <Typography
                                  variant="caption"
                                  color="textSecondary"
                                >
                                  {o.sublabel}
                                </Typography>
                              )}
                            </Box>
                          )}
                          onChange={(_, next) =>
                            setCompareTargetName(next?.name ?? null)
                          }
                          renderInput={params => (
                            <TextField
                              {...params}
                              variant="outlined"
                              placeholder="Pick a revision…"
                              inputProps={{
                                ...params.inputProps,
                                'aria-label': 'Compare with',
                              }}
                            />
                          )}
                        />
                      </Box>
                      {!compareTarget ? (
                        <Box className={classes.empty}>
                          <Typography variant="body2">
                            Pick a revision to compare against.
                          </Typography>
                        </Box>
                      ) : (
                        <YamlDiffViewer
                          original={revisionYaml(compareTarget)}
                          modified={highlightedYaml}
                          originalLabel={`${revisionName(
                            compareTarget,
                          )} (${formatRelativeTime(
                            compareTarget.metadata.creationTimestamp,
                          )})`}
                          modifiedLabel={revisionName(highlighted)}
                          height="50vh"
                        />
                      )}
                    </>
                  )}
                </>
              ) : (
                <Box className={classes.empty}>
                  {highlightedGone ? (
                    <Typography variant="body2" data-testid="revision-gone">
                      {highlightedName} is no longer available: it has been
                      deleted. Pick another revision on the left.
                    </Typography>
                  ) : (
                    <Typography variant="body2">
                      Pick a revision on the left to see details.
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions>
        {((highlighted && onDelete) || historyLimitControl) && (
          <Box className={classes.footerStart}>
            {highlighted && onDelete && (
              <Tooltip title={deleteBlocked ?? ''}>
                <span>
                  <Button
                    variant="outlined"
                    size="small"
                    className={classes.deleteButton}
                    startIcon={<DeleteOutlineIcon fontSize="small" />}
                    disabled={!!deleteBlocked}
                    onClick={() => onDelete(highlighted)}
                  >
                    Delete r{revisionNumber(highlighted)}
                  </Button>
                </span>
              </Tooltip>
            )}
            {historyLimitControl}
          </Box>
        )}
        <Button onClick={onClose}>Cancel</Button>
        {highlighted && (
          <Tooltip title={blocked ?? ''}>
            <span>
              <Button
                variant="contained"
                color="primary"
                disabled={!!blocked}
                onClick={() => onRollback(highlighted)}
              >
                Roll back to r{revisionNumber(highlighted)}
              </Button>
            </span>
          </Tooltip>
        )}
      </DialogActions>
    </Dialog>
  );
};
