import { useEffect, useMemo, useState } from 'react';
import { Skeleton } from '@openchoreo/backstage-design-system';
import {
  Box,
  Chip,
  Divider,
  MenuItem,
  Paper,
  Popper,
  TextField,
  Tooltip,
  Typography,
} from '@material-ui/core';
import type { PaperProps, PopperProps } from '@material-ui/core';
import { alpha, makeStyles } from '@material-ui/core/styles';
import { Autocomplete } from '@material-ui/lab';
import AddIcon from '@material-ui/icons/Add';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import type { ComponentRelease } from '@openchoreo/backstage-plugin-common';
import {
  extractImage,
  formatRelativeTime,
  shortenImage,
  type ReleaseDeployments,
} from './releaseFormatters';

const MAX_VISIBLE_RELEASES = 4;
// Tall enough to fit 4 two-line option rows (~56px each) plus a bit of
// breathing room, so the listbox itself never needs to scroll at the cap.
// The hint row and footer render outside the listbox in PaperComponent.
const LISTBOX_MAX_HEIGHT = 260;

/**
 * Force the Autocomplete popup to render below the input. Default MUI
 * Popper flips upward when there isn't enough space, which is jarring in
 * the setup card (the panel sits low in the viewport). We'd rather extend
 * past the fold and let the page scroll than have the menu jump.
 */
const BottomPopper = (props: PopperProps) => (
  <Popper
    {...props}
    placement="bottom-start"
    modifiers={{
      flip: { enabled: false },
      preventOverflow: { enabled: false },
    }}
  />
);

const useStyles = makeStyles(theme => ({
  option: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    gap: 2,
    width: '100%',
  },
  optionTopRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    minWidth: 0,
  },
  optionName: {
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
    flexShrink: 1,
  },
  optionMeta: {
    color: theme.palette.text.secondary,
    fontSize: 12,
  },
  envChip: {
    height: 20,
    fontSize: 11,
    maxWidth: '100%',
    backgroundColor: alpha(theme.palette.primary.main, 0.15),
    color: theme.palette.primary.main,
    fontWeight: 500,
    border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
    flexShrink: 0,
  },
  hintRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    fontSize: '0.8125rem',
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
  },
  footer: {
    borderTop: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    position: 'sticky',
    bottom: 0,
  },
  footerItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    fontSize: '0.875rem',
  },
  // Primary-tinted footer row for "New release" — reads as the CTA
  // inside the dropdown rather than blending into the picker chrome.
  // Tinted background (not solid) so it still feels like a menu item;
  // a contained button would fight the surrounding popper styling.
  footerItemPrimary: {
    color: theme.palette.primary.main,
    fontWeight: 500,
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
    '&:hover': {
      backgroundColor: alpha(theme.palette.primary.main, 0.16),
    },
  },
}));

export interface ReleaseSelectProps {
  releases: ComponentRelease[];
  selectedReleaseName: string | null;
  onSelectedReleaseChange: (name: string | null) => void;
  deployments: ReleaseDeployments;
  firstEnvironmentName: string;
  loading?: boolean;
  onCreateRelease?: () => void;
  canCreateRelease?: boolean;
  createDisabledReason?: string;
  onOpenReleaseBrowser: () => void;
}

interface CurrentEnvChipProps {
  envName: string;
  className?: string;
}

/**
 * Compact "env this release is currently deployed to" chip. Matches the
 * primary-chip styling used by `DeployedEnvBadges` so the visual language
 * stays consistent with the Release Browser.
 */
const CurrentEnvChip = ({ envName, className }: CurrentEnvChipProps) => {
  const classes = useStyles();
  return (
    <Chip
      label={envName}
      size="small"
      className={`${classes.envChip}${className ? ` ${className}` : ''}`}
    />
  );
};

/**
 * Compact, searchable release picker for the auto-deploy-OFF setup card.
 * The two heavier actions ("+ New release", "Open Release Browser") live in
 * a sticky footer inside the dropdown so they stay reachable without
 * cluttering the top of the panel.
 *
 * The list is capped to the 5 most recent releases when no search query is
 * entered; typing reveals the full filtered set. A hint row above the
 * footer surfaces the truncation and lets the user open the Release
 * Browser to see the rest.
 */
export const ReleaseSelect = ({
  releases,
  selectedReleaseName,
  onSelectedReleaseChange,
  deployments,
  firstEnvironmentName,
  loading,
  onCreateRelease,
  canCreateRelease,
  createDisabledReason,
  onOpenReleaseBrowser,
}: ReleaseSelectProps) => {
  const classes = useStyles();
  const targetEnv = firstEnvironmentName.toLowerCase();

  const selected = useMemo(
    () => releases.find(r => r.metadata?.name === selectedReleaseName) ?? null,
    [releases, selectedReleaseName],
  );

  const noReleases = !loading && releases.length === 0;

  const isCurrent = (release: ComponentRelease) =>
    (deployments[release.metadata?.name ?? ''] ?? []).some(
      e => e.toLowerCase() === targetEnv,
    );

  const metaLine = (release: ComponentRelease) => {
    const age = formatRelativeTime(release.metadata?.creationTimestamp);
    const image = extractImage(release);
    const parts = [age, image ? `img: ${shortenImage(image)}` : ''].filter(
      Boolean,
    );
    return parts.join(' · ');
  };

  // Controlled input so the closed state shows the selected release's
  // name instead of the search placeholder. We clear on open so the user
  // can type a query immediately, then restore on close.
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(selected?.metadata?.name ?? '');

  // Keep input in sync when the selection changes externally (e.g. the
  // parent's auto-snap-to-newest effect, or the Release Browser confirming
  // a different release). Only mirror the name while the popup is closed —
  // mid-typing we leave the user's query alone.
  useEffect(() => {
    if (!open) {
      setInputValue(selected?.metadata?.name ?? '');
    }
  }, [selected, open]);

  const truncationActive =
    inputValue.trim() === '' && releases.length > MAX_VISIBLE_RELEASES;
  const hiddenCount = truncationActive
    ? releases.length - MAX_VISIBLE_RELEASES
    : 0;

  const PaperWithFooter = (props: PaperProps) => (
    <Paper {...props}>
      {props.children}
      {truncationActive && (
        <Box onMouseDown={e => e.preventDefault()}>
          <Divider />
          <MenuItem
            dense
            onClick={() => {
              setOpen(false);
              onOpenReleaseBrowser();
            }}
            className={classes.hintRow}
          >
            <Typography variant="body2" color="textSecondary">
              …and {hiddenCount} more in Release Browser
            </Typography>
          </MenuItem>
        </Box>
      )}
      <Box className={classes.footer} onMouseDown={e => e.preventDefault()}>
        <Divider />
        {onCreateRelease && (
          <Tooltip title={canCreateRelease ? '' : createDisabledReason ?? ''}>
            <span>
              <MenuItem
                dense
                disabled={!canCreateRelease}
                onClick={() => onCreateRelease()}
                className={`${classes.footerItem} ${classes.footerItemPrimary}`}
              >
                <AddIcon fontSize="small" color="inherit" />
                <Typography variant="body2" color="inherit">
                  New release
                </Typography>
              </MenuItem>
            </span>
          </Tooltip>
        )}
        <MenuItem
          dense
          onClick={() => {
            setOpen(false);
            onOpenReleaseBrowser();
          }}
          className={classes.footerItem}
        >
          <OpenInNewIcon fontSize="small" />
          <Typography variant="body2">Open Release Browser</Typography>
        </MenuItem>
      </Box>
    </Paper>
  );

  if (loading) {
    return <Skeleton variant="rect" height={40} />;
  }

  return (
    <Autocomplete<ComponentRelease, false, false, false>
      size="small"
      options={releases}
      value={selected ?? null}
      disabled={noReleases}
      noOptionsText={
        <Typography variant="caption" color="textSecondary">
          No releases found
        </Typography>
      }
      PopperComponent={BottomPopper}
      ListboxProps={{ style: { maxHeight: LISTBOX_MAX_HEIGHT } }}
      open={open}
      onOpen={() => {
        setOpen(true);
        // Clear so the user can type a query immediately; if they close
        // without picking anything the useEffect restores the name.
        setInputValue('');
      }}
      onClose={() => {
        setOpen(false);
        setInputValue(selected?.metadata?.name ?? '');
      }}
      inputValue={inputValue}
      onInputChange={(_, next, reason) => {
        // Programmatic 'reset' fires on selection / external value sync —
        // let our useEffect own that case so we don't fight it.
        if (reason === 'input' || reason === 'clear') {
          setInputValue(next);
        }
      }}
      getOptionLabel={r => r.metadata?.name ?? ''}
      getOptionSelected={(o, v) => o.metadata?.name === v.metadata?.name}
      filterOptions={(opts, state) => {
        const q = state.inputValue.trim().toLowerCase();
        if (!q) return opts.slice(0, MAX_VISIBLE_RELEASES);
        return opts.filter(r => {
          const name = (r.metadata?.name ?? '').toLowerCase();
          const image = (extractImage(r) ?? '').toLowerCase();
          return name.includes(q) || image.includes(q);
        });
      }}
      onChange={(_, next) => {
        if (next) onSelectedReleaseChange(next.metadata?.name ?? null);
      }}
      renderOption={r => (
        <Box className={classes.option}>
          <Box className={classes.optionTopRow}>
            <Typography variant="body2" className={classes.optionName}>
              {r.metadata?.name}
            </Typography>
            {isCurrent(r) && <CurrentEnvChip envName={firstEnvironmentName} />}
          </Box>
          <Typography variant="caption" className={classes.optionMeta}>
            {metaLine(r)}
          </Typography>
        </Box>
      )}
      renderInput={params => (
        // The env chip is intentionally suppressed inside the input: when
        // the selected release is already deployed to the first env, the
        // disabled Deploy button + tooltip already communicate that. The
        // chip still appears next to matching options in the list so
        // users can see at a glance which release is currently bound.
        <TextField
          {...params}
          variant="outlined"
          placeholder={noReleases ? 'No releases yet' : 'Search releases…'}
          helperText={selected ? metaLine(selected) : undefined}
        />
      )}
      PaperComponent={PaperWithFooter}
    />
  );
};
