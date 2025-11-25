import { makeStyles } from '@material-ui/core/styles';

/**
 * Main styles for the Environments component
 * Includes global keyframe animation for refresh spinner
 */
export const useEnvironmentsStyles = makeStyles(_theme => ({
  '@global': {
    '@keyframes spin': {
      from: { transform: 'rotate(0deg)' },
      to: { transform: 'rotate(360deg)' },
    },
  },
}));

/**
 * Styles for notification banner
 */
export const useNotificationStyles = makeStyles(theme => ({
  notificationBox: {
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid`,
    boxShadow: theme.shadows[4],
  },
  successNotification: {
    backgroundColor: theme.palette.success.light,
    borderColor: theme.palette.success.main,
    color: theme.palette.success.dark,
  },
  errorNotification: {
    backgroundColor: theme.palette.error.light,
    borderColor: theme.palette.error.main,
    color: theme.palette.error.dark,
  },
}));

/**
 * Styles for the setup card
 */
export const useSetupCardStyles = makeStyles(theme => ({
  setupCard: {
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    minHeight: '300px',
    display: 'flex',
    flexDirection: 'column',
  },
  cardContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
}));

/**
 * Styles for environment card content
 */
export const useEnvironmentCardStyles = makeStyles(theme => ({
  cardContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  imageContainer: {
    backgroundColor: theme.palette.background.default,
    padding: theme.spacing(1.5),
    borderRadius: theme.spacing(0.5),
    border: `1px solid ${theme.palette.divider}`,
    marginTop: theme.spacing(1),
    fontFamily: 'monospace',
  },
  sectionLabel: {
    fontWeight: 600,
    fontSize: '0.875rem',
    color: theme.palette.text.primary,
    marginBottom: theme.spacing(1),
  },
  endpointLink: {
    color: theme.palette.primary.main,
    textDecoration: 'underline',
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: '0.875rem',
  },
  timeIcon: {
    fontSize: '1rem',
    color: theme.palette.text.secondary,
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
  },
}));

/**
 * Styles for loading skeleton states
 */
export const useLoadingSkeletonStyles = makeStyles(_theme => ({
  skeletonContainer: {
    height: '200px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
}));

/**
 * Styles for deployment status (currently unused but kept for reference)
 */
export const useDeploymentStatusStyles = makeStyles(theme => ({
  deploymentStatusBox: {
    padding: theme.spacing(1.5),
    borderRadius: theme.shape.borderRadius,
    marginTop: theme.spacing(2),
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  successStatus: {
    backgroundColor: theme.palette.success.light,
    color: theme.palette.success.dark,
  },
  errorStatus: {
    backgroundColor: theme.palette.error.light,
    color: theme.palette.error.dark,
  },
  warningStatus: {
    backgroundColor: theme.palette.warning.light,
    color: theme.palette.warning.dark,
  },
  defaultStatus: {
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
  },
}));
