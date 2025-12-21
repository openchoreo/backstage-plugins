import { makeStyles } from '@material-ui/core/styles';

export const useStyles = makeStyles(theme => ({
  tableWrapper: {
    '& tbody tr': {
      cursor: 'pointer',
      transition: 'background-color 0.2s ease',
      '&:hover': {
        backgroundColor: theme.palette.action.hover,
      },
    },
  },
}));
