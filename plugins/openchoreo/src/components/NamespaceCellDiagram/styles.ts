import { makeStyles } from '@material-ui/core/styles';

export const useNamespaceCellDiagramStyles = makeStyles(theme => ({
  root: {
    height: 'calc(100vh - 146px)',
    width: 'calc(100% + 48px)',
    margin: theme.spacing(-3),
    backgroundColor: theme.palette.background.default,
    color: theme.palette.text.primary,
    borderTop: `1px solid ${theme.palette.divider}`,
    position: 'relative',
  },
  centered: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
