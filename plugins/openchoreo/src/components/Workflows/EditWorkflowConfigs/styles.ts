import { makeStyles } from '@material-ui/core/styles';

export const useEditWorkflowStyles = makeStyles(theme => ({
  dialogTitle: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: theme.spacing(1),
  },
  closeButton: {
    marginLeft: theme.spacing(2),
  },
  dialogContent: {
    minHeight: '400px',
    paddingTop: theme.spacing(2),
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(4),
    gap: theme.spacing(2),
    minHeight: '400px',
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
    gap: theme.spacing(2),
  },
  helpText: {
    padding: theme.spacing(2),
    backgroundColor: theme.palette.background.default,
    borderRadius: theme.shape.borderRadius,
    marginBottom: theme.spacing(2),
  },
  changesPreview: {
    backgroundColor: '#f5f5f5',
    borderRadius: '4px',
    maxHeight: '300px',
    overflow: 'auto',
    padding: theme.spacing(2),
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
}));
