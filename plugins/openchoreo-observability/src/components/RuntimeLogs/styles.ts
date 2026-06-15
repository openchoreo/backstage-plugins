import { makeStyles } from '@material-ui/core/styles';

export const useRuntimeLogsStyles = makeStyles(theme => ({
  errorContainer: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
}));

export const useLogsActionsStyles = makeStyles(theme => ({
  statsContainer: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionsContainer: {
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'center',
  },
}));

export const useLogsTableStyles = makeStyles(theme => ({
  tablePaper: {
    marginBottom: theme.spacing(0),
    paddingBottom: theme.spacing(1),
  },
  // Legacy MUI table styles still used by sibling tables (AlertsTable,
  // IncidentsTable) that cross-import this hook. The runtime logs view itself
  // no longer renders an MUI <Table> — it uses the headerRow / headerColumn /
  // cell / skeletonRow div styles below.
  tableContainer: {
    maxHeight: 'calc(100vh - 320px)',
    overflowY: 'auto',
    overflowX: 'hidden',
    width: '100%',
  },
  table: {
    width: '100%',
    tableLayout: 'fixed',
  },
  headerCell: {
    fontWeight: 'bold',
    backgroundColor: theme.palette.background.paper,
    position: 'sticky',
    top: 0,
    zIndex: 1,
    fontSize: '0.75rem',
    padding: '4px 8px !important',
  },
  // Div-based header row that sits *inside* the virtualized scroll container
  // so it shares the rows' content width (no scrollbar-gutter misalignment).
  // `position: sticky` keeps it visible while the rows scroll beneath it,
  // matching the original `<TableHead stickyHeader>` behaviour. The border
  // colour matches MUI's hardcoded `<TableCell>` colour (light grey) rather
  // than `palette.divider` (which is alpha-based and blends darker against
  // Backstage's Paper background).
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    position: 'sticky',
    top: 0,
    zIndex: 1,
    backgroundColor: theme.palette.background.paper,
    borderBottom: `1px solid ${theme.palette.grey[100]}`,
  },
  headerColumn: {
    fontWeight: 'bold',
    fontSize: '0.75rem',
    // More vertical breathing than the row cells — matches the visual weight
    // the original `<TableHead>` had over the bare `padding: 4px 8px` value.
    padding: '12px 8px',
    minWidth: 0,
    boxSizing: 'border-box',
  },
  skeletonRow: {
    display: 'flex',
    alignItems: 'center',
    borderBottom: `1px solid ${theme.palette.grey[100]}`,
  },
  cell: {
    padding: '4px 8px',
    minWidth: 0,
    boxSizing: 'border-box',
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

export const useLogEntryStyles = makeStyles(theme => ({
  logRow: {
    cursor: 'pointer',
    // Match MUI `<TableCell>`'s hardcoded light grey rather than
    // `palette.divider`, which is alpha-based and blends darker against
    // Backstage's Paper background.
    borderBottom: `1px solid ${theme.palette.grey[100]}`,
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
    // Reveal the hover-action button when this row is hovered
    '&:hover $hoverActionButton': {
      opacity: 1,
      pointerEvents: 'auto',
    },
  },
  // Flex container replacing the former <TableRow>; columns are sized via
  // getColumnStyle so they align with the sticky header row. `alignItems:
  // 'center'` mirrors the default `vertical-align: middle` of MUI table cells,
  // so the LogLevel chip and timestamp stay centered when the Log column wraps
  // to multiple lines.
  logRowMain: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
  },
  // Replaces the former <TableCell>; keeps the 4px/8px padding.
  cell: {
    padding: '4px 8px',
    minWidth: 0,
    boxSizing: 'border-box',
  },
  hoverActionButton: {
    opacity: 0,
    pointerEvents: 'none',
    transition: 'opacity 0.15s ease',
  },
  expandedRow: {
    backgroundColor: theme.palette.action.selected,
  },
  monospaceCell: {
    fontFamily: 'monospace',
    fontSize: '11px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  logLevelChip: {
    fontSize: '0.6rem',
    fontWeight: 'bold',
    minWidth: '40px',
    height: '14px !important',
    '& .MuiChip-label': {
      padding: '0 4px',
    },
  },
  errorChip: {
    backgroundColor: theme.palette.error.light,
    color: theme.palette.error.dark,
    outline: `1px solid ${theme.palette.error.main}`,
  },
  warnChip: {
    backgroundColor: theme.palette.warning.light,
    color: theme.palette.warning.dark,
    outline: `1px solid ${theme.palette.warning.main}`,
  },
  infoChip: {
    backgroundColor: theme.palette.info.light,
    color: theme.palette.info.dark,
    outline: `1px solid ${theme.palette.info.main}`,
  },
  debugChip: {
    backgroundColor: theme.palette.action.disabledBackground,
    color: theme.palette.text.disabled,
    outline: `1px solid ${theme.palette.text.secondary}`,
  },
  undefinedChip: {
    backgroundColor: theme.palette.action.disabledBackground,
    color: theme.palette.text.disabled,
    outline: `1px solid ${theme.palette.text.secondary}`,
  },
  logMessage: {
    fontFamily: 'monospace',
    fontSize: '11px',
    wordBreak: 'break-word',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'pre-wrap',
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    maxWidth: '100%',
  },
  expandedLogMessage: {
    whiteSpace: 'pre-wrap',
    overflow: 'visible',
    display: 'block',
    WebkitLineClamp: 'unset' as any,
    WebkitBoxOrient: 'unset' as any,
  },
  logCell: {
    overflow: 'hidden',
    textOverflow: 'clip',
    whiteSpace: 'normal',
  },
  logCellContent: {
    display: 'flex',
    alignItems: 'flex-start',
    width: '100%',
  },
  logTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  logActionColumn: {
    // Wide enough for the Copy + Investigate icons to sit side by
    // side. The column used to be a 24 px single-icon slot, which
    // forced the second icon to wrap below the first.
    width: theme.spacing(8),
    minWidth: theme.spacing(8),
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: theme.spacing(0.25),
    flexShrink: 0,
    marginLeft: theme.spacing(1),
  },
  containerCell: {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  podCell: {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
    fontFamily: 'monospace',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  expandButton: {
    padding: 0,
    '& .MuiSvgIcon-root': {
      fontSize: '1rem',
    },
  },
  expandedContent: {
    padding: theme.spacing(2),
    backgroundColor: theme.palette.background.default,
    borderRadius: theme.shape.borderRadius,
  },
  metadataSection: {
    marginTop: theme.spacing(2),
  },
  metadataTitle: {
    fontWeight: 'bold',
    marginBottom: theme.spacing(1),
    fontSize: '11px',
  },
  metadataGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: theme.spacing(1),
  },
  metadataItem: {
    display: 'flex',
    marginBottom: theme.spacing(0.5),
  },
  metadataKey: {
    fontWeight: 'bold',
    minWidth: '120px',
    marginRight: theme.spacing(1),
    fontSize: '11px',
  },
  metadataValue: {
    fontFamily: 'monospace',
    fontSize: '11px',
    color: theme.palette.text.secondary,
  },
  copyButton: {
    // Compact padding so the icon sits flush with the
    // InvestigateLogButton next to it (both render in
    // ``logActionColumn``). The expanded-detail copy button on the
    // metadata section sets its own marginTop locally rather than
    // relying on a class default.
    padding: theme.spacing(0.5),
  },
  fullLogMessage: {
    fontFamily: 'monospace',
    fontSize: '11px',
    whiteSpace: 'pre-wrap',
    backgroundColor: theme.palette.background.paper,
    padding: theme.spacing(1),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    maxHeight: '200px',
    overflow: 'auto',
  },
  metadataBox: {
    backgroundColor: theme.palette.background.paper,
    padding: theme.spacing(1),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
  },
  expandedSectionTitle: {
    fontSize: '11px',
    fontWeight: 'bold',
  },
}));
