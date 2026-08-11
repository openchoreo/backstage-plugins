import { makeStyles } from '@material-ui/core/styles';

export const useStyles = makeStyles(theme => ({
  platformDetailsSection: {
    marginBottom: theme.spacing(4),
  },
  starredEntitiesWrapper: {
    height: '100%',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    '& > div': {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
    },
    '& .MuiCard-root, & .MuiPaper-root': {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
    },
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
