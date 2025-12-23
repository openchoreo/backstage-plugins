import { makeStyles } from '@material-ui/core/styles';

export const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(2),
    borderLeft: `4px solid`,
    backgroundColor: theme.palette.background.paper,
    position: 'relative',
    gap: theme.spacing(1),
  },
  primary: {
    borderLeftColor: theme.palette.primary.main,
    backgroundColor: theme.palette.primary.light,
  },
  info: {
    borderLeftColor: theme.palette.info.main,
    backgroundColor: theme.palette.info.light + '15',
  },
  error: {
    borderLeftColor: theme.palette.error.main,
    backgroundColor: theme.palette.error.light,
  },
  warning: {
    borderLeftColor: theme.palette.warning.main,
    backgroundColor: theme.palette.warning.light,
  },
  success: {
    borderLeftColor: theme.palette.success.main,
    backgroundColor: theme.palette.success.light + '15',
  },
  secondary: {
    borderLeftColor: theme.palette.grey[500],
    backgroundColor: theme.palette.grey[100],
  },
  iconContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    flexShrink: 0,
  },
  // iconContainerPrimary: {
  //   backgroundColor: theme.palette.primary.light + '40',
  // },
  // iconContainerInfo: {
  //   backgroundColor: theme.palette.info.light + '40',
  // },
  // iconContainerError: {
  //   backgroundColor: theme.palette.error.light + '40',
  // },
  // iconContainerWarning: {
  //   backgroundColor: theme.palette.warning.light + '40',
  // },
  // iconContainerSuccess: {
  //   backgroundColor: theme.palette.success.light + '40',
  // },
  iconContainerSecondary: {
    backgroundColor: theme.palette.grey[300],
  },
  iconPrimary: {
    color: theme.palette.primary.main,
  },
  iconInfo: {
    color: theme.palette.info.main,
  },
  iconError: {
    color: theme.palette.error.main,
  },
  iconWarning: {
    color: theme.palette.warning.main,
  },
  iconSuccess: {
    color: theme.palette.success.main,
  },
  iconSecondary: {
    color: theme.palette.grey[700],
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    // gap: theme.spacing(0.5),
  },
  title: {
    fontWeight: 600,
    fontSize: '1rem',
    color: theme.palette.text.primary,
  },
  message: {
    fontSize: '0.875rem',
    color: theme.palette.text.secondary,
  },
  closeButton: {
    padding: theme.spacing(0.5),
    marginTop: -theme.spacing(0.5),
    marginRight: -theme.spacing(0.5),
  },
}));
