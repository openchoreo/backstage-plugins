import { makeStyles } from '@material-ui/core/styles';

export const useTriggersStyles = makeStyles(theme => ({
  successChip: {
    backgroundColor: '#c8e6c9',
    color: '#2e7d32',
    outline: '1px solid #4caf50',
  },
  runningChip: {
    backgroundColor: theme.palette.info.light,
    color: theme.palette.info.dark,
    outline: `1px solid ${theme.palette.info.main}`,
  },
  statusChipReason: {
    marginLeft: 4,
    fontSize: '0.55rem',
    fontStyle: 'italic',
    fontWeight: 'normal',
    opacity: 0.85,
  },
  retriesContainer: {
    padding: theme.spacing(1, 2),
  },
  retriesTable: {
    '& td': {
      padding: '4px 8px !important',
      fontSize: '0.75rem',
    },
    '& th': {
      padding: '4px 8px !important',
      fontSize: '0.7rem',
      fontWeight: 'bold',
    },
  },
  eventsContainer: {
    padding: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
  eventItem: {
    display: 'flex',
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 0),
    borderBottom: `1px solid ${theme.palette.divider}`,
    fontSize: '11px',
    fontFamily: 'monospace',
    '&:last-child': {
      borderBottom: 'none',
    },
  },
  eventTimestamp: {
    color: theme.palette.text.secondary,
    whiteSpace: 'nowrap',
    minWidth: 160,
  },
  eventReason: {
    fontWeight: 'bold',
    minWidth: 140,
  },
  eventMessage: {
    color: theme.palette.text.secondary,
    wordBreak: 'break-word',
    flex: 1,
  },
  warningEvent: {
    color: theme.palette.warning.dark,
  },
  sectionTitle: {
    fontSize: '11px',
    fontWeight: 'bold',
    marginBottom: theme.spacing(0.5),
    marginTop: theme.spacing(1),
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(0.5),
    cursor: 'pointer',
    userSelect: 'none',
  },
  sectionHeaderTitle: {
    fontSize: '11px',
    fontWeight: 'bold',
    flex: 1,
  },
  sectionToggleIcon: {
    fontSize: '16px',
    color: theme.palette.text.secondary,
  },
  sectionRefreshButton: {
    padding: 2,
  },
  sectionRefreshIcon: {
    fontSize: '14px',
  },
  logsContainer: {
    maxHeight: 220,
    overflowY: 'auto',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 4,
    backgroundColor: theme.palette.background.default,
    padding: theme.spacing(0.5, 1),
  },
  logLine: {
    display: 'flex',
    gap: theme.spacing(1),
    fontSize: '11px',
    fontFamily: 'monospace',
    padding: '2px 0',
    borderBottom: `1px solid ${theme.palette.divider}`,
    '&:last-child': {
      borderBottom: 'none',
    },
  },
  logTimestamp: {
    color: theme.palette.text.secondary,
    whiteSpace: 'nowrap',
    minWidth: 160,
  },
  logLevel: {
    fontWeight: 'bold',
    minWidth: 50,
    textTransform: 'uppercase',
  },
  logPod: {
    color: theme.palette.text.secondary,
    minWidth: 0,
    maxWidth: 220,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  logMessage: {
    flex: 1,
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
  },
  logLevelError: {
    color: theme.palette.error.main,
  },
  logLevelWarn: {
    color: theme.palette.warning.dark,
  },
  logLevelInfo: {
    color: theme.palette.info.dark,
  },
  logLevelDebug: {
    color: theme.palette.text.secondary,
  },
}));
