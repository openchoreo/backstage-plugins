import { makeStyles } from '@material-ui/core/styles';

export const useStyles = makeStyles(theme => ({
  logsContainer: {
    backgroundColor: theme.palette.background.default,
    fontFamily: 'monospace',
    fontSize: '12px',
    height: 'calc(100vh - 400px)',
    minHeight: '300px',
    overflow: 'auto',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    whiteSpace: 'pre-wrap',
    padding: theme.spacing(2),
  },
  timestampText: {
    fontSize: '11px',
    color: theme.palette.text.secondary,
  },
  logText: {
    fontSize: '12px',
    color: theme.palette.text.primary,
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '200px',
    gap: theme.spacing(1),
  },
}));
