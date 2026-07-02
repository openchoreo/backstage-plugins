import { makeStyles } from '@material-ui/core/styles';

export const useTerminalPanelStyles = makeStyles(theme => ({
  root: {
    width: '100%',
    height: '100%',
    minHeight: 400,
    backgroundColor: '#1e1e1e',
    borderRadius: theme.shape.borderRadius,
    overflow: 'hidden',
    '& .xterm': {
      height: '100%',
      padding: theme.spacing(1),
    },
    '& .xterm-viewport': {
      overflowY: 'auto',
    },
  },
}));
