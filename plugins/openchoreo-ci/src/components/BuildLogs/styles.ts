import { makeStyles } from '@material-ui/core/styles';

export const useStyles = makeStyles(theme => ({
  stepsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  stepAccordion: {
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    '&:before': {
      display: 'none',
    },
  },
  stepHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  stepTitle: {
    fontWeight: 500,
  },
  stepStatusChip: {
    marginLeft: theme.spacing(1),
  },
  logsContainer: {
    flex: 'auto',
    backgroundColor: theme.palette.background.default,
    fontFamily: 'monospace',
    fontSize: '12px',
    minHeight: '300px',
    overflow: 'auto',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    whiteSpace: 'pre-wrap',
    padding: theme.spacing(2),
  },
  logText: {
    fontSize: '12px',
    color: theme.palette.text.primary,
  },
  noLogsText: {
    fontSize: '12px',
    color: theme.palette.text.secondary,
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '200px',
    gap: theme.spacing(1),
  },
  inlineLoadingContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 0),
  },
}));
