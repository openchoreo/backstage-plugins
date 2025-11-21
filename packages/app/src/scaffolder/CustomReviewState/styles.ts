import { makeStyles } from '@material-ui/core';

export const useStyles = makeStyles(theme => ({
  footer: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gridGap: theme.spacing(1),
    marginTop: theme.spacing(2),
  },
  nestedContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  },
  nestedItem: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
  },
  nestedLabel: {
    fontWeight: 500,
    color: theme.palette.text.secondary,
    minWidth: 'fit-content',
    '&::after': {
      content: '":"',
    },
  },
  nestedValue: {
    color: theme.palette.text.primary,
    wordBreak: 'break-word',
  },
  arrayItemContainer: {
    padding: theme.spacing(1),
    marginBottom: theme.spacing(1),
    borderLeft: `2px solid ${theme.palette.divider}`,
    paddingLeft: theme.spacing(2),
  },
  arrayItemHeader: {
    fontWeight: 600,
    marginBottom: theme.spacing(0.5),
    color: theme.palette.text.secondary,
  },
}));
