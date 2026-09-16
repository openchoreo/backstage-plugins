import { makeStyles } from '@material-ui/core/styles';

export const useStyles = makeStyles(theme => ({
  platformDetailsGrid: {
    marginTop: theme.spacing(3),
  },
  platformDetailsSection: {
    marginBottom: theme.spacing(4),
  },
  searchBarInput: {
    maxWidth: '60vw',
    margin: 'auto',
    backgroundColor: theme.palette.background.paper,
    borderRadius: '50px',
    boxShadow: theme.shadows[1],
  },
  searchBarOutline: {
    borderStyle: 'none',
  },
}));
