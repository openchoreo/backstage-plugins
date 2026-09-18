import { makeStyles } from '@material-ui/core';

export const usePlatformLogsToolbarStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.25),
  },
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.25),
    // The controls wrap rather than shrink below a usable width, so a narrow viewport
    // gets a second line instead of six unreadable inputs.
    flexWrap: 'wrap',
  },
  plane: {
    minWidth: 190,
  },
  planeOption: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    lineHeight: 1.3,
  },
  timeRange: {
    // The trigger only ever shows a short preset ("Last 10 minutes"); the picker itself
    // opens in a popover, so the field does not need room for a date range.
    width: 158,
  },
  search: {
    // The one control that should absorb spare width: a log search is often long.
    flex: '1 1 220px',
    minWidth: 180,
  },
  action: {
    height: 40,
    whiteSpace: 'nowrap',
  },
  countBadge: {
    marginLeft: theme.spacing(0.75),
    height: 18,
    minWidth: 18,
    fontSize: 11,
    fontWeight: 600,
    // Inherits the button's colour so it reads as part of the control in both the
    // outlined and contained states.
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
    color: 'inherit',
  },
  liveOn: {
    fontSize: 12,
    color: theme.palette.success.main,
  },
  liveOff: {
    fontSize: 12,
    color: theme.palette.text.disabled,
  },
  chips: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(0.75),
  },
  chip: {
    maxWidth: 320,
  },
  clearAll: {
    textTransform: 'none',
    color: theme.palette.text.secondary,
  },
}));

export const useFacetSelectStyles = makeStyles(theme => ({
  // Sits where Autocomplete would put its tags, so it reads as the field's value.
  summary: {
    paddingLeft: theme.spacing(0.5),
    color: theme.palette.text.primary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
  },
  // "All" is the absence of a filter, so it reads as placeholder rather than value.
  summaryEmpty: {
    paddingLeft: theme.spacing(0.5),
    color: theme.palette.text.disabled,
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
    width: '100%',
  },
  optionLabel: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  // Pushed to the far edge so the counts line up as a column rather than trailing each
  // value at a different offset.
  optionCount: {
    marginLeft: 'auto',
    paddingLeft: theme.spacing(1),
    color: theme.palette.text.secondary,
    fontVariantNumeric: 'tabular-nums',
  },
}));

export const usePlatformLogsFilterRowStyles = makeStyles(theme => ({
  root: {
    paddingTop: theme.spacing(2),
  },
}));

export const usePlatformLogsResultStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
  },
  count: {
    fontVariantNumeric: 'tabular-nums',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  columns: {
    minWidth: 150,
  },
}));

export const usePlatformLogEntryRowStyles = makeStyles(theme => ({
  // A filterable value in the expanded row. Sized to match the plain metadata values
  // around it, so the panel reads the same with or without the buttons.
  drill: {
    font: 'inherit',
    fontFamily: 'monospace',
    fontSize: '11px',
    padding: '0 4px',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 4,
    background: 'none',
    color: theme.palette.text.secondary,
    cursor: 'pointer',
    textAlign: 'left',
    wordBreak: 'break-all',
    '&:hover:not(:disabled)': {
      borderColor: theme.palette.primary.main,
      color: theme.palette.text.primary,
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 1,
    },
    // Already applied: still legible, but plainly not something to click again.
    '&:disabled': {
      cursor: 'default',
      borderStyle: 'dashed',
    },
  },
}));
