import { makeStyles } from '@material-ui/core/styles';

export const useRuntimeEventsStyles = makeStyles(theme => ({
  errorContainer: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
}));

export const useEventsActionsStyles = makeStyles(theme => ({
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

export const useEventsTableStyles = makeStyles(theme => ({
  tablePaper: {
    marginBottom: theme.spacing(0),
    paddingBottom: theme.spacing(1),
  },
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

export const useEventEntryStyles = makeStyles(theme => ({
  eventRow: {
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
    cursor: 'pointer',
    '& > td': {
      padding: '4px 8px !important',
    },
    // Reveal the hover-action button when this row is hovered
    '&:hover $hoverActionButton': {
      opacity: 1,
      pointerEvents: 'auto',
    },
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
  typeChip: {
    fontSize: '0.6rem',
    fontWeight: 'bold',
    minWidth: '40px',
    height: '14px !important',
    '& .MuiChip-label': {
      padding: '0 4px',
    },
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
  eventMessage: {
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
  expandedEventMessage: {
    whiteSpace: 'pre-wrap',
    overflow: 'visible',
    display: 'block',
    WebkitLineClamp: 'unset' as any,
    WebkitBoxOrient: 'unset' as any,
  },
  messageCell: {
    overflow: 'hidden',
    textOverflow: 'clip',
    whiteSpace: 'normal',
  },
  messageCellContent: {
    display: 'flex',
    alignItems: 'flex-start',
    width: '100%',
  },
  messageTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  eventActionColumn: {
    width: theme.spacing(5),
    minWidth: theme.spacing(5),
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: theme.spacing(0.25),
    flexShrink: 0,
    marginLeft: theme.spacing(1),
  },
  copyButton: {
    padding: theme.spacing(0.5),
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
  fullEventMessage: {
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
