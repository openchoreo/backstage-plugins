import { makeStyles } from '@material-ui/core/styles';

export const useTokenFilterBarStyles = makeStyles(theme => ({
  clearAll: {
    padding: 4,
  },
  // MUI reveals the clear button only on hover or focus. `!important` because
  // the rule it overrides sits on this same element and would otherwise be
  // settled by stylesheet injection order. Applied only when there is something
  // to clear — the button is rendered either way and hidden by that rule.
  clearAllShown: {
    visibility: 'visible !important' as 'visible',
  },
  // MUI centres this on the field, so it slides down as the chips wrap onto
  // further lines. A fixed offset both holds it still and centres it on the
  // first row, which is where it reads as belonging.
  endAdornment: {
    top: 6,
    right: 8,
  },
  // Pinned to the height of an empty small outlined field — the controls beside
  // it are exactly that — so a single row of chips does not make this one taller
  // than its neighbours. It still grows once the chips wrap.
  inputRoot: {
    minHeight: 38,
    // `!important` because MUI's dense rule is an attribute selector and wins
    // on specificity; its 6px padding makes a row of chips 40 tall.
    paddingTop: '3px !important',
    paddingBottom: '3px !important',
    alignContent: 'center',
  },
  root: { position: 'relative' },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    height: 24,
    margin: 2,
    // Only a chip wider than the field itself is cut; the rest are shown whole
    // or not at all.
    maxWidth: 'calc(100% - 4px)',
  },
  chipLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    minWidth: 0,
    maxWidth: '100%',
  },
  chipPath: {
    fontWeight: 600,
    color: theme.palette.primary.main,
    flex: '0 0 auto',
  },
  chipSeparator: {
    margin: '0 3px 0 1px',
    color: theme.palette.text.secondary,
    flex: '0 0 auto',
  },
  // Truncating here rather than on the chip leaves the delete button its own
  // space, so a long value cannot run under it.
  chipValue: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  hint: {
    display: 'block',
    marginTop: theme.spacing(0.5),
    color: theme.palette.text.secondary,
  },
  popover: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  popoverHeader: {
    padding: theme.spacing(1, 1.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  popoverFooter: {
    padding: theme.spacing(1, 1.5),
    borderTop: `1px solid ${theme.palette.divider}`,
    color: theme.palette.text.secondary,
  },
  option: {
    display: 'block',
  },
  optionRow: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  optionValueRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    width: '100%',
    minWidth: 0,
  },
  optionPath: { fontWeight: 600 },
  optionValue: {
    flex: 1,
    minWidth: 0,
    wordBreak: 'break-all',
  },
  optionDesc: {
    color: theme.palette.text.secondary,
    fontSize: theme.typography.pxToRem(12),
  },
  optionCount: {
    color: theme.palette.text.secondary,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
}));
