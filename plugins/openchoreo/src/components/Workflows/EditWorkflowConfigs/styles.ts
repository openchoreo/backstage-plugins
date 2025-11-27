import { makeStyles } from '@material-ui/core/styles';

export const useEditWorkflowStyles = makeStyles(theme => ({
  changesPreview: {
    backgroundColor: theme.palette.type === 'dark' ? '#333' : '#f5f5f5',
    borderRadius: '4px',
    maxHeight: '300px',
    overflow: 'auto',
    padding: theme.spacing(2),
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
}));
