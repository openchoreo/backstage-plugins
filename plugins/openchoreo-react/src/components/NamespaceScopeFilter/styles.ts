import { makeStyles } from '@material-ui/core/styles';

export const useNamespaceScopeFilterStyles = makeStyles(theme => ({
  triggerButton: {
    textTransform: 'none',
    fontSize: '0.8rem',
    fontWeight: 500,
    padding: theme.spacing(0.5, 1.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 6,
    color: theme.palette.text.primary,
    minWidth: 0,
    '&:hover': {
      borderColor: theme.palette.text.secondary,
    },
    '& .MuiButton-label': {
      minWidth: 0,
    },
  },
  triggerButtonFullWidth: {
    width: '100%',
    justifyContent: 'space-between',
  },
  triggerLabel: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
  },
  popoverPaper: {
    minWidth: 220,
  },
  menuItem: {
    minHeight: 36,
    paddingTop: 2,
    paddingBottom: 2,
  },
  checkbox: {
    padding: 4,
  },
  subheader: {
    lineHeight: '28px',
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: theme.palette.text.secondary,
  },
}));
