import { makeStyles, Theme } from '@material-ui/core/styles';

export const useStyles = makeStyles((theme: Theme) => ({
  buttonGroup: {
    borderRadius: 8,
    '& .MuiButton-root': {
      borderRadius: 'inherit',
    },
    '& .MuiButton-root:not(:last-child)': {
      borderTopRightRadius: 0,
      borderBottomRightRadius: 0,
    },
    '& .MuiButton-root:not(:first-child)': {
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0,
    },
  },
  dropdownButton: {
    padding: '6px 4px',
    minWidth: 'unset',
    borderLeft: `1px solid ${theme.palette.primary.dark}`,
  },
}));
