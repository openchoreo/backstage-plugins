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

export const useLogEntryStyles = makeStyles(theme => ({
  logRow: {
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
    cursor: 'pointer',
    '& > td': {
      padding: '4px 8px !important',
    },
  },
  expandedRow: {
    backgroundColor: theme.palette.action.selected,
  },
  timestampCell: {
    fontFamily: 'monospace',
    fontSize: '0.75rem',
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
    backgroundColor: theme.palette.error.main,
    color: theme.palette.error.contrastText,
  },
  warnChip: {
    backgroundColor: theme.palette.warning.main,
    color: theme.palette.warning.contrastText,
  },
  infoChip: {
    backgroundColor: theme.palette.info.main,
    color: theme.palette.info.contrastText,
  },
  debugChip: {
    backgroundColor: theme.palette.action.disabled,
    color: theme.palette.text.secondary,
  },
  undefinedChip: {
    backgroundColor: theme.palette.action.disabledBackground,
    color: theme.palette.text.disabled,
  },
  logMessage: {
    fontFamily: 'monospace',
    fontSize: '0.75rem',
    wordBreak: 'break-word',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '100%',
  },
  expandedLogMessage: {
    whiteSpace: 'pre-wrap',
    overflow: 'visible',
  },
  logCell: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
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
  },
  metadataItem: {
    display: 'flex',
    marginBottom: theme.spacing(0.5),
  },
  metadataKey: {
    fontWeight: 'bold',
    minWidth: '120px',
    marginRight: theme.spacing(1),
  },
  metadataValue: {
    fontFamily: 'monospace',
    fontSize: '0.875rem',
    color: theme.palette.text.secondary,
  },
  copyButton: {
    padding: 0,
    marginLeft: theme.spacing(1),
  },
  fullLogMessage: {
    fontFamily: 'monospace',
    fontSize: '0.875rem',
    whiteSpace: 'pre-wrap',
    backgroundColor: theme.palette.background.paper,
    padding: theme.spacing(1),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    maxHeight: '200px',
    overflow: 'auto',
  },
}));
