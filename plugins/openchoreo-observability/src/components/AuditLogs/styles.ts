import { makeStyles } from '@material-ui/core/styles';

/**
 * The result pill, one class per outcome. Taken from the palette rather than
 * baked, so both themes stay legible.
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
}));

export const useAuditPageStyles = makeStyles(theme => ({
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
    marginBottom: theme.spacing(1.5),
  },
  sectionTitle: {
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1.5),
  },
  // For a title sharing a row with other content, where the row carries the
  // spacing: a margin of its own would lift it off the row's centre line.
  inlineSectionTitle: { marginBottom: 0 },
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
    marginBottom: theme.spacing(1.5),
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
  pathSegmentDrill: {
    font: 'inherit',
    cursor: 'pointer',
    '&:hover': { borderColor: theme.palette.primary.main },
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
}));
