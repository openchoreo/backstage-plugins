import { makeStyles, useTheme } from '@material-ui/core/styles';

/**
 * Outcome to a palette colour, shared by the result pill's dot, the row accent
 * and the chart marks so one result reads the same everywhere. A baked hex
 * would go invisible in the other theme.
 */
export function useResultColor(): Record<string, string> {
  const theme = useTheme();
  return {
    success: theme.palette.success.main,
    failure: theme.palette.error.main,
    denied: theme.palette.warning.main,
    unauthenticated: theme.palette.grey[500],
  };
}

/**
 * The result pill, one class per outcome. Taken from the palette rather than
 * baked, so both themes stay legible — and so the pill, the row accent and the
 * chart marks agree on what "denied" looks like.
 */
export const useAuditResultPillStyles = makeStyles(theme => ({
  success: {
    color: theme.palette.success.dark,
    backgroundColor: theme.palette.success.light,
  },
  failure: {
    color: theme.palette.error.dark,
    backgroundColor: theme.palette.error.light,
  },
  denied: {
    color: theme.palette.warning.dark,
    backgroundColor: theme.palette.warning.light,
  },
  unauthenticated: {
    color: theme.palette.text.secondary,
    backgroundColor: theme.palette.action.hover,
  },
}));

export const useAuditPageStyles = makeStyles(theme => ({
  section: { marginTop: theme.spacing(2) },
  errorContainer: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  windowNotice: { marginTop: theme.spacing(1) },
  // A dropdown of fixed presets, so it is sized to its content rather than
  // stretched across a share of the row. The filter beside it takes the rest.
  timeRangeItem: {
    [theme.breakpoints.up('md')]: { width: 260, flex: '0 0 auto' },
  },
}));

export const useAuditLensesStyles = makeStyles(theme => ({
  row: {
    display: 'flex',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  lens: {
    flex: '1 1 150px',
    minWidth: 140,
    padding: theme.spacing(1.25, 1.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.background.paper,
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    cursor: 'pointer',
    font: 'inherit',
    '&:hover': { backgroundColor: theme.palette.action.hover },
  },
  lensStatic: { cursor: 'default', '&:hover': { backgroundColor: 'inherit' } },
  lensActive: {
    borderColor: theme.palette.primary.main,
    backgroundColor: theme.palette.action.selected,
  },
  lensQuiet: { opacity: 0.6 },
  lensKey: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    color: theme.palette.text.secondary,
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    display: 'inline-block',
  },
  lensValue: {
    fontSize: '1.375rem',
    fontWeight: 600,
    lineHeight: 1.2,
  },
  lensNote: {
    color: theme.palette.text.secondary,
    fontSize: '0.6875rem',
  },
}));

export const useAuditTimelineStyles = makeStyles(theme => ({
  card: {
    padding: theme.spacing(1.5),
    marginTop: theme.spacing(2),
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
    flexWrap: 'wrap',
  },
  title: { fontWeight: 600 },
  sub: { color: theme.palette.text.secondary },
  grow: { flex: 1 },
  chartBox: { height: 168, width: '100%' },
  tooltip: {
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    boxShadow: theme.shadows[2],
    padding: theme.spacing(1, 1.25),
    fontSize: 12,
    minWidth: 168,
  },
  tooltipTime: {
    fontWeight: 600,
    marginBottom: theme.spacing(0.5),
  },
  tooltipRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
  },
  tooltipSwatch: {
    width: 8,
    height: 8,
    borderRadius: 2,
    flex: '0 0 auto',
  },
  tooltipLabel: {
    flex: 1,
    color: theme.palette.text.secondary,
    whiteSpace: 'nowrap',
  },
  tooltipCount: { fontVariantNumeric: 'tabular-nums' },
  tooltipTotal: {
    marginTop: theme.spacing(0.5),
    paddingTop: theme.spacing(0.5),
    borderTop: `1px solid ${theme.palette.divider}`,
    fontWeight: 600,
  },
  legend: {
    display: 'flex',
    gap: theme.spacing(1.5),
    flexWrap: 'wrap',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    color: theme.palette.text.secondary,
    fontSize: '0.75rem',
  },
  legendSwatch: {
    width: 8,
    height: 8,
    borderRadius: 2,
    display: 'inline-block',
  },
  unknown: {
    padding: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
}));

export const useAuditChartSectionStyles = makeStyles(theme => ({
  card: {
    marginTop: theme.spacing(2),
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
    padding: theme.spacing(1, 1.5),
    cursor: 'pointer',
    '&:hover': { backgroundColor: theme.palette.action.hover },
    '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}` },
  },
  title: { fontWeight: 600 },
  titleIcon: { color: theme.palette.text.secondary },
  grow: { flex: 1 },
  body: {
    padding: theme.spacing(0, 1.5, 1.5),
  },
}));

export const useAuditActionsStyles = makeStyles(theme => ({
  statsContainer: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  actionsContainer: {
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  liveDot: { fontSize: 12 },
  liveDotOn: { color: theme.palette.success.main },
}));

export const useAuditTableStyles = makeStyles(theme => ({
  tablePaper: {
    marginBottom: 0,
    paddingBottom: theme.spacing(1),
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    position: 'sticky',
    top: 0,
    zIndex: 1,
    backgroundColor: theme.palette.background.paper,
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  headerColumn: {
    fontWeight: 'bold',
    fontSize: '0.75rem',
    padding: '12px 8px',
    minWidth: 0,
    boxSizing: 'border-box',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  skeletonRow: {
    display: 'flex',
    alignItems: 'center',
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  cell: {
    padding: '6px 8px',
    minWidth: 0,
    boxSizing: 'border-box',
    overflow: 'hidden',
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing(4),
    color: theme.palette.text.secondary,
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing(2),
  },
}));

export const useAuditRowStyles = makeStyles(theme => ({
  row: {
    display: 'flex',
    alignItems: 'center',
    borderBottom: `1px solid ${theme.palette.divider}`,
    cursor: 'pointer',
    // The left accent is how an outcome reads at a glance while scanning; the
    // pill states it, this makes a run of denials visible without reading.
    borderLeft: '3px solid transparent',
    '&:hover': { backgroundColor: theme.palette.action.hover },
    '&:hover $copyButton': { opacity: 1 },
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: -2,
    },
  },
  rowSelected: { backgroundColor: theme.palette.action.selected },
  copyButton: {
    opacity: 0,
    transition: 'opacity 120ms',
    padding: 4,
  },
  accentSuccess: { borderLeftColor: 'transparent' },
  accentFailure: { borderLeftColor: theme.palette.error.main },
  accentDenied: { borderLeftColor: theme.palette.warning.main },
  accentUnauthenticated: { borderLeftColor: theme.palette.grey[500] },
  cell: {
    padding: '6px 8px',
    minWidth: 0,
    boxSizing: 'border-box',
    overflow: 'hidden',
  },
  // After `cell`, whose padding it overrides: the column is sized to the button
  // alone, so the usual horizontal padding leaves no room for it.
  actionsCell: {
    padding: '6px 1px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeAbs: {
    fontSize: '0.75rem',
    fontFamily: 'monospace',
    whiteSpace: 'nowrap',
  },
  timeRel: {
    fontSize: '0.6875rem',
    color: theme.palette.text.secondary,
    whiteSpace: 'nowrap',
  },
  actor: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    minWidth: 0,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    flex: '0 0 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.625rem',
    fontWeight: 700,
    backgroundColor: theme.palette.primary.light,
    color: theme.palette.primary.dark,
  },
  avatarService: {
    backgroundColor: theme.palette.info.light,
    color: theme.palette.info.dark,
  },
  avatarAnonymous: {
    backgroundColor: theme.palette.action.hover,
    color: theme.palette.text.secondary,
  },
  truncate: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  actorId: {
    fontSize: '0.8125rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  subtle: {
    fontSize: '0.6875rem',
    color: theme.palette.text.secondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: '0.75rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'block',
  },
  verb: {
    display: 'inline-block',
    padding: '1px 5px',
    marginRight: 6,
    borderRadius: 4,
    fontSize: '0.625rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    backgroundColor: theme.palette.action.hover,
    color: theme.palette.text.secondary,
  },
  verbCreate: {
    backgroundColor: theme.palette.success.light,
    color: theme.palette.success.dark,
  },
  verbDelete: {
    backgroundColor: theme.palette.error.light,
    color: theme.palette.error.dark,
  },
  verbUpdate: {
    backgroundColor: theme.palette.info.light,
    color: theme.palette.info.dark,
  },
  pill: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 12,
    fontSize: '0.6875rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  absent: {
    color: theme.palette.text.disabled,
    fontSize: '0.75rem',
  },
  scope: {
    fontSize: '0.75rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  scopeSeparator: {
    color: theme.palette.text.disabled,
    margin: '0 3px',
  },
}));

export const useAuditDrawerStyles = makeStyles(theme => ({
  // Wider than the default drawer: the record is mostly label/value pairs, and
  // the extra width is what stops the long ones wrapping into several lines.
  paper: {
    width: 760,
    maxWidth: '100vw',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  // The record's identity stays put while its detail scrolls under it.
  head: {
    flex: '0 0 auto',
    padding: theme.spacing(2),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  eyebrow: {
    display: 'flex',
    alignItems: 'center',
    color: theme.palette.text.secondary,
    fontSize: '0.6875rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  grow: { flex: 1 },
  title: {
    fontFamily: 'monospace',
    fontSize: '1.125rem',
    fontWeight: 600,
    marginTop: theme.spacing(0.5),
    wordBreak: 'break-all',
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
    flexWrap: 'wrap',
    color: theme.palette.text.secondary,
    fontSize: '0.75rem',
  },
  body: {
    flex: '1 1 auto',
    minHeight: 0,
    overflowY: 'auto',
    padding: theme.spacing(2),
  },
  section: { marginBottom: theme.spacing(3) },
  sectionHead: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  sectionTitle: {
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: theme.palette.text.secondary,
  },
  kv: {
    display: 'grid',
    gridTemplateColumns: '148px minmax(0, 1fr)',
    gap: `${theme.spacing(1)}px ${theme.spacing(1.5)}px`,
    margin: 0,
    // Top-aligned rather than baseline: a value may be a bordered drill button,
    // a wrapped string or two lines of hint, and baseline alignment moved the
    // label with whichever it was.
    alignItems: 'start',
  },
  key: {
    color: theme.palette.text.secondary,
    fontSize: '0.75rem',
    lineHeight: 1.5,
    // Meets the first line of the value, which sets a larger font.
    paddingTop: 2,
  },
  value: {
    margin: 0,
    fontSize: '0.8125rem',
    lineHeight: 1.5,
    minWidth: 0,
    wordBreak: 'break-word',
  },
  valueMono: { fontFamily: 'monospace' },
  valueHint: {
    display: 'block',
    color: theme.palette.text.secondary,
    fontSize: '0.6875rem',
    lineHeight: 1.45,
    marginTop: 3,
    // A measure that stays readable; the drawer is wide enough that a hint
    // would otherwise run the full width as one long line.
    maxWidth: '52ch',
  },
  absent: { color: theme.palette.text.disabled },
  drill: {
    font: 'inherit',
    fontFamily: 'monospace',
    padding: '1px 4px',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 4,
    background: 'none',
    color: theme.palette.text.primary,
    cursor: 'pointer',
    textAlign: 'left',
    wordBreak: 'break-all',
    // A user agent or an issuer URL can run to several lines and push the rest
    // of the record off screen. Three lines is enough to recognise one; the
    // button's title carries the whole value.
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 3,
    overflow: 'hidden',
    maxWidth: '100%',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
      borderColor: theme.palette.primary.main,
    },
  },
  // The scope reads as part of the heading rather than under it.
  whereHead: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  path: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    minWidth: 0,
  },
  pathSegment: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.action.hover,
    padding: theme.spacing(0.25, 0.75),
    maxWidth: '100%',
  },
  pathKey: {
    fontSize: '0.625rem',
    lineHeight: 1.6,
    color: theme.palette.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    flex: '0 0 auto',
  },
  // The level's name is the thing being read; the key beside it only says which
  // level it is.
  pathValue: {
    fontFamily: 'monospace',
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: theme.palette.text.primary,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  // A flex item rather than inline-block: the pill sets a smaller font than the
  // text beside it, and an inline box centres on its own line box, which left
  // it sitting off the row.
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: 12,
    fontSize: '0.6875rem',
    fontWeight: 600,
    lineHeight: 1.5,
    whiteSpace: 'nowrap',
    flex: '0 0 auto',
  },
  notice: {
    display: 'flex',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.action.hover,
    fontSize: '0.8125rem',
    marginBottom: theme.spacing(2),
  },
}));
