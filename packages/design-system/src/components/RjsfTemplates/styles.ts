import { makeStyles, Theme } from '@material-ui/core/styles';

export const useArrayStyles = makeStyles((theme: Theme) => ({
  container: {
    marginBottom: theme.spacing(2),
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(1),
  },
  title: {
    fontWeight: 600,
  },
  description: {
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1.5),
  },
  item: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
    padding: theme.spacing(2),
    marginBottom: theme.spacing(1),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    backgroundColor: theme.palette.background.paper,
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
    '& > .MuiFormControl-root:last-child': {
      marginBottom: 0,
    },
    '& > fieldset': {
      border: 'none',
      padding: 0,
      margin: 0,
    },
    '& > fieldset > legend': {
      position: 'absolute',
      width: 1,
      height: 1,
      padding: 0,
      margin: -1,
      overflow: 'hidden',
      clip: 'rect(0 0 0 0)',
      whiteSpace: 'nowrap',
      border: 0,
    },
  },
  itemActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    paddingTop: theme.spacing(1),
  },
  actionButton: {
    padding: 4,
    color: theme.palette.text.secondary,
    '&:hover': {
      color: theme.palette.text.primary,
    },
  },
  addButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(0.5),
    width: '100%',
    padding: theme.spacing(1),
    border: `1px dashed ${theme.palette.divider}`,
    borderRadius: 8,
    color: theme.palette.text.secondary,
    cursor: 'pointer',
    backgroundColor: 'transparent',
    fontSize: theme.typography.body2.fontSize,
    fontFamily: theme.typography.fontFamily,
    transition: 'border-color 0.15s, color 0.15s',
    '&:hover': {
      borderColor: theme.palette.primary.main,
      color: theme.palette.primary.main,
    },
  },
}));
