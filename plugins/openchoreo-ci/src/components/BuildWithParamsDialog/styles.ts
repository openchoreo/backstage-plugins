import { makeStyles } from '@material-ui/core/styles';

export const useStyles = makeStyles(theme => ({
  dialogContent: {
    paddingTop: theme.spacing(1),
  },
  workflowInfo: {
    marginBottom: theme.spacing(3),
  },
  sectionTitle: {
    marginBottom: theme.spacing(2),
  },
  gitFieldsSection: {
    marginBottom: theme.spacing(3),
  },
  formSection: {
    marginTop: theme.spacing(1),
  },
  formContainer: {
    '& .MuiFormControl-root': {
      marginBottom: theme.spacing(1),
    },
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(4),
  },
  errorText: {
    marginTop: theme.spacing(1),
    color: theme.palette.error.main,
  },
}));
