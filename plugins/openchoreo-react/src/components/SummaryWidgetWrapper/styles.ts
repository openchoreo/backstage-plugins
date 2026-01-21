import { makeStyles } from '@material-ui/core/styles';

export const useStyles = makeStyles(theme => ({
  widget: {
    borderRadius: theme.spacing(1),
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    padding: theme.spacing(3),
    boxShadow: theme.shadows[2],
    height: theme.spacing(27),
  },
  widgetHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(3),
    paddingBottom: theme.spacing(2),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  metricRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
    padding: theme.spacing(1),
    marginLeft: theme.spacing(-1),
    marginRight: theme.spacing(-1),
    borderRadius: theme.spacing(0.5),
    transition: 'background-color 0.15s ease-in-out',
    '&:last-child': {
      marginBottom: 0,
    },
  },
  metricRowClickable: {
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  metricLabel: {
    color: theme.palette.text.secondary,
  },
  metricValue: {
    fontWeight: 700,
    color: theme.palette.text.primary,
  },
  skeleton: {
    marginBottom: theme.spacing(2),
    borderRadius: theme.spacing(0.5),
    '&:last-child': {
      marginBottom: 0,
    },
  },
  errorContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: theme.spacing(10),
    gridGap: theme.spacing(1),
  },
}));
