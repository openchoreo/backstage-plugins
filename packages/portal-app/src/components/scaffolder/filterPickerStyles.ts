import { makeStyles } from '@material-ui/core/styles';

export const useFilterPickerStyles = makeStyles(theme => ({
  root: {},
  label: {
    fontWeight: 'bold',
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.text.primary,
    marginBottom: theme.spacing(0.5),
    display: 'block',
  },
  formControl: {
    width: '100%',
  },
  select: {
    fontSize: 14,
    height: 44,
    backgroundColor: theme.palette.background.paper,
    '& .MuiSelect-select': {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      flexWrap: 'nowrap',
      overflow: 'hidden',
      height: '100% !important',
      boxSizing: 'border-box',
      padding: '0 32px 0 14px !important',
    },
  },
  chips: {
    display: 'flex',
    flexWrap: 'nowrap',
    gap: 4,
    overflow: 'hidden',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  chip: {
    height: 24,
    borderRadius: 12,
    fontSize: '0.8rem',
    fontWeight: 500,
    flexShrink: 0,
    backgroundColor: theme.palette.grey[200],
    color: theme.palette.text.primary,
    '& .MuiChip-label': {
      paddingLeft: 10,
      paddingRight: 4,
    },
    '& .MuiChip-deleteIcon': {
      fontSize: 16,
      color: theme.palette.text.secondary,
      marginRight: 4,
      '&:hover': {
        color: theme.palette.text.primary,
      },
    },
  },
  overflowChip: {
    height: 24,
    borderRadius: 12,
    fontSize: '0.8rem',
    fontWeight: 600,
    flexShrink: 0,
    backgroundColor: theme.palette.grey[300],
    color: theme.palette.text.primary,
    cursor: 'default',
  },
  placeholder: {
    color: theme.palette.text.secondary,
    fontSize: 14,
  },
  menuItem: {
    fontSize: 14,
    padding: theme.spacing(0.5, 1.5),
  },
}));
