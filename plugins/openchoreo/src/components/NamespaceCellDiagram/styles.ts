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

export const useProjectCellPreviewStyles = makeStyles(theme => ({
  popper: {
    zIndex: theme.zIndex.modal,
  },
  paper: {
    overflow: 'hidden',
    maxWidth: '92vw',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 1, 1, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  title: {
    flex: '1 1 auto',
    minWidth: 0,
    fontWeight: 600,
    fontSize: '0.875rem',
    color: theme.palette.text.primary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  headerActions: {
    flex: '0 0 auto',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  },
  // Diagram area — the library paints its own (dotted) background here.
  canvas: {
    position: 'relative',
    width: 'min(670px, 88vw)',
    height: 'min(450px, 64vh)',
    backgroundColor: theme.palette.background.default,
  },
}));
