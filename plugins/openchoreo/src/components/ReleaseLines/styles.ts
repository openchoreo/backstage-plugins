import { makeStyles } from '@material-ui/core/styles';

export const useCreateReleaseLineDialogStyles = makeStyles(theme => ({
  field: {
    marginBottom: theme.spacing(2),
  },
}));

export const useReleaseLineDefinitionStyles = makeStyles(theme => ({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  panel: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing(1),
    minHeight: theme.spacing(5),
  },
  panelTitle: {
    fontWeight: 600,
  },
  panelCaption: {
    color: theme.palette.text.secondary,
  },
  editorContainer: {
    flex: 1,
    minHeight: 420,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    overflow: 'hidden',
  },
  readOnlyContainer: {
    flex: 1,
    minHeight: 420,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.background.default,
    overflow: 'auto',
  },
}));
