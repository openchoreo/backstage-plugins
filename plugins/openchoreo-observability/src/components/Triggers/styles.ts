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
}));
