import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Chip,
  Divider,
  MenuItem,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from '@material-ui/core';
import type { PaperProps } from '@material-ui/core';
import { Autocomplete } from '@material-ui/lab';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import VerifiedUserOutlinedIcon from '@material-ui/icons/VerifiedUserOutlined';
import { useChoreoTokens } from '@openchoreo/backstage-design-system';
import type { BindingRevision } from '@openchoreo/backstage-plugin-common';
import {
  BottomPopper,
  LISTBOX_MAX_HEIGHT,
  MAX_VISIBLE_RELEASES,
  useReleaseSelectStyles,
} from './ReleaseSelect';
import { formatRelativeTime } from './releaseFormatters';
import {
  healthPill,
  isActive,
  isKnownGood,
  revisionAccessibleName,
  revisionName,
  revisionNumber,
  revisionMessage,
  revisionReleaseName,
  shortMessage,
} from '../utils/revisionUtils';
import { matchesRevision } from './RevisionBrowserDialog';

export interface RevisionSelectProps {
  /** Revisions newest first. */
  revisions: BindingRevision[];
  selectedRevisionName: string | null;
  onSelectedRevisionChange: (name: string) => void;
  /** Names of releases that still exist; null while unknown. */
  releaseNames: ReadonlySet<string> | null;
  onOpenRevisionBrowser: () => void;
}

/** "3h ago · Healthy · Deploy", the line under a revision's name. */
const MetaLine = ({
  revision,
  gone,
}: {
  revision: BindingRevision;
  gone: boolean;
}) => (
  <>
    <span data-testid="revision-time">
      {formatRelativeTime(revision.metadata.creationTimestamp)}
    </span>
    {' · '}
    <span data-testid="revision-health">
      {healthPill(revision.status?.health).label}
    </span>
    {' · '}
    <span data-testid="revision-cause">{revision.spec.cause}</span>
    {gone && ' · release deleted'}
    {revisionMessage(revision) && (
      <>
        {' · '}
        <span data-testid="revision-message" title={revisionMessage(revision)}>
          {shortMessage(revisionMessage(revision)!)}
        </span>
      </>
    )}
  </>
);

/**
 * The revision picker in the environment side panel, built like the
 * release picker in the Deploy panel (ReleaseSelect): the selected revision
 * shows in the field, defaulting to the active one, and the dropdown lists
 * the others, searchable, with the Revision Browser in its footer. The
 * active revision carries an "Active" chip, as the release picker marks the
 * release deployed to the environment.
 */
export const RevisionSelect = ({
  revisions,
  selectedRevisionName,
  onSelectedRevisionChange,
  releaseNames,
  onOpenRevisionBrowser,
}: RevisionSelectProps) => {
  const classes = useReleaseSelectStyles();
  const tokens = useChoreoTokens();

  const selected = useMemo(
    () => revisions.find(r => r.metadata.name === selectedRevisionName) ?? null,
    [revisions, selectedRevisionName],
  );
  const isGone = (rev: BindingRevision) =>
    !!releaseNames && !releaseNames.has(revisionReleaseName(rev));

  // Same open/close handling as ReleaseSelect: the closed field shows the
  // selected name; opening clears it so a query can be typed straight away.
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(
    selected ? revisionName(selected) : '',
  );
  useEffect(() => {
    if (!open) setInputValue(selected ? revisionName(selected) : '');
  }, [selected, open]);

  const truncationActive =
    inputValue.trim() === '' && revisions.length > MAX_VISIBLE_RELEASES;
  const hiddenCount = truncationActive
    ? revisions.length - MAX_VISIBLE_RELEASES
    : 0;

  const openBrowser = () => {
    setOpen(false);
    onOpenRevisionBrowser();
  };

  const PaperWithFooter = (props: PaperProps) => (
    <Paper {...props}>
      {props.children}
      {truncationActive && (
        <Box onMouseDown={e => e.preventDefault()}>
          <Divider />
          <MenuItem dense onClick={openBrowser} className={classes.hintRow}>
            <Typography variant="body2" color="textSecondary">
              …and {hiddenCount} more in Revision Browser
            </Typography>
          </MenuItem>
        </Box>
      )}
      <Box className={classes.footer} onMouseDown={e => e.preventDefault()}>
        <Divider />
        <MenuItem dense onClick={openBrowser} className={classes.footerItem}>
          <OpenInNewIcon fontSize="small" />
          <Typography variant="body2">Open Revision Browser</Typography>
        </MenuItem>
      </Box>
    </Paper>
  );

  return (
    // DisableClearable is typed boolean, not true, so the value can be null:
    // controlled from the first render, before the revisions have loaded.
    <Autocomplete<BindingRevision, false, boolean, false>
      size="small"
      options={revisions}
      value={selected}
      disableClearable
      disabled={revisions.length === 0}
      noOptionsText={
        <Typography variant="caption" color="textSecondary">
          No revisions found
        </Typography>
      }
      PopperComponent={BottomPopper}
      ListboxProps={{
        style: { maxHeight: LISTBOX_MAX_HEIGHT },
        'aria-label': 'Revisions',
      }}
      open={open}
      onOpen={() => {
        setOpen(true);
        setInputValue('');
      }}
      onClose={() => {
        setOpen(false);
        setInputValue(selected ? revisionName(selected) : '');
      }}
      inputValue={inputValue}
      onInputChange={(_, next, reason) => {
        if (reason === 'input' || reason === 'clear') setInputValue(next);
      }}
      getOptionLabel={r => revisionName(r)}
      getOptionSelected={(o, v) => o.metadata.name === v.metadata.name}
      filterOptions={(opts, state) => {
        const q = state.inputValue.trim();
        if (!q) return opts.slice(0, MAX_VISIBLE_RELEASES);
        return opts.filter(r => matchesRevision(r, q));
      }}
      onChange={(_, next) => {
        if (next) onSelectedRevisionChange(next.metadata.name);
      }}
      renderOption={r => (
        <Box
          className={classes.option}
          aria-label={revisionAccessibleName(r)}
          data-testid={`revision-row-${revisionNumber(r)}`}
        >
          <Box className={classes.optionTopRow}>
            <Typography
              variant="body2"
              className={classes.optionName}
              style={isGone(r) ? { textDecoration: 'line-through' } : undefined}
              data-testid="revision-name"
            >
              {revisionName(r)}
            </Typography>
            {isActive(r) && (
              <Chip
                label="Active"
                size="small"
                className={classes.envChip}
                data-testid="revision-active"
              />
            )}
            {isKnownGood(r) && (
              <Tooltip title="Known good: stayed healthy for the known-good window">
                <VerifiedUserOutlinedIcon
                  style={{ fontSize: 16, color: tokens.status.ok }}
                  aria-label="Known good"
                  data-testid="revision-known-good"
                />
              </Tooltip>
            )}
          </Box>
          <Typography variant="caption" className={classes.optionMeta}>
            <MetaLine revision={r} gone={isGone(r)} />
          </Typography>
        </Box>
      )}
      renderInput={params => (
        <TextField
          {...params}
          variant="outlined"
          placeholder="Search revisions…"
          inputProps={{ ...params.inputProps, 'aria-label': 'Revision' }}
          helperText={
            selected ? (
              <MetaLine revision={selected} gone={isGone(selected)} />
            ) : undefined
          }
          FormHelperTextProps={
            { 'data-testid': 'revision-selected-meta' } as object
          }
        />
      )}
      PaperComponent={PaperWithFooter}
    />
  );
};
