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
    padding: 24,
    borderRadius: 12,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    border: `1px dashed ${theme.palette.divider}`,
  },
  cardContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center' as const,
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1.5),
  },
  titleIcon: {
    color: theme.palette.text.primary,
    fontSize: '1.25rem',
  },
  title: {
    fontWeight: 600,
    // fontSize: '0.9rem',
    color: theme.palette.text.primary,
    // textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
}));

/**
 * Styles for the setup card in compact mode (mini node on the deploy canvas)
 */
export const useSetupCardCompactStyles = makeStyles(theme => ({
  setupCard: {
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    padding: theme.spacing(1.5),
    borderRadius: 12,
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    border: `1px dashed ${theme.palette.divider}`,
    gap: theme.spacing(1),
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  titleIcon: {
    color: theme.palette.text.primary,
    fontSize: '1.1rem',
  },
  title: {
    fontWeight: 600,
    color: theme.palette.text.primary,
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    margin: 0,
  },
  workloadButtonWrapper: {
    marginTop: 'auto',
    display: 'flex',
    justifyContent: 'flex-end',
  },
}));

/**
 * Styles for the compact environment node used by the deploy canvas.
 */
export const useMiniEnvironmentNodeStyles = makeStyles(theme => ({
  card: {
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    boxShadow: theme.shadows[1],
    display: 'flex',
    flexDirection: 'column',
    cursor: 'pointer',
    overflow: 'hidden',
    transition: 'box-shadow 120ms ease, transform 120ms ease',
    '&:hover': {
      boxShadow: theme.shadows[3],
    },
  },
  cardSelected: {
    boxShadow: `inset 0 0 0 2px ${theme.palette.primary.main}, ${theme.shadows[3]}`,
  },
  statusStripe: {
    width: 4,
    height: '100%',
    flexShrink: 0,
  },
  body: {
    flex: 1,
    minWidth: 0,
    padding: theme.spacing(1, 1.25),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  },
  topRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(0.5),
    minWidth: 0,
  },
  name: {
    fontWeight: 600,
    fontSize: '0.95rem',
    lineHeight: 1.2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    color: theme.palette.text.secondary,
    fontSize: '0.8rem',
    minWidth: 0,
  },
  versionChip: {
    fontFamily:
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    fontSize: '0.78rem',
    fontWeight: 500,
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.action.hover,
    borderRadius: 4,
    padding: theme.spacing(0.25, 0.75),
    whiteSpace: 'nowrap',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  statusDotActive: {
    backgroundColor: theme.palette.success.main,
  },
  statusDotPending: {
    backgroundColor: theme.palette.warning.main,
  },
  statusDotFailed: {
    backgroundColor: theme.palette.error.main,
  },
  statusDotIdle: {
    backgroundColor: theme.palette.action.disabled,
  },
  timeText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  actionRow: {
    marginTop: 'auto',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  menuButton: {
    padding: theme.spacing(0.25),
  },
  primaryButton: {
    textTransform: 'none',
  },
}));

/**
 * Styles for the deploy split view (left canvas + right detail panel).
 */
export const useDeployFlowCanvasStyles = makeStyles(theme => ({
  splitContainer: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 380px',
    gap: theme.spacing(2),
    width: '100%',
    minHeight: 'calc(100vh - 260px)',
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: '1fr',
      gridAutoRows: 'min-content',
    },
  },
  canvasFrame: {
    position: 'relative',
    width: '100%',
    height: '100%',
    minHeight: 480,
    backgroundColor: theme.palette.background.default,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 12,
    overflow: 'hidden',
  },
  canvasContainer: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
    cursor: 'grab',
    '&:active': {
      cursor: 'grabbing',
    },
  },
  canvasContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    transformOrigin: '0 0',
  },
  nodeWrapper: {
    position: 'absolute',
  },
  setupNodeWrapper: {
    position: 'absolute',
    display: 'flex',
    alignItems: 'center',
  },
  controlsOverlay: {
    position: 'absolute',
    bottom: theme.spacing(2),
    right: theme.spacing(2),
    zIndex: 2,
  },
  minimapOverlay: {
    position: 'absolute',
    bottom: theme.spacing(2),
    left: theme.spacing(2),
    zIndex: 2,
  },
  detailPanelFrame: {
    minHeight: 480,
    height: '100%',
  },
}));

/**
 * Styles for the right-pane environment detail panel.
 */
export const useEnvironmentDetailPanelStyles = makeStyles(theme => ({
  panel: {
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: theme.spacing(4),
    color: theme.palette.text.secondary,
    gap: theme.spacing(2),
  },
  emptyIcon: {
    fontSize: '3rem',
    color: theme.palette.action.disabled,
  },
  header: {
    padding: theme.spacing(2, 2.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  headerTopRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
  },
  headerStatusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  envName: {
    fontWeight: 600,
    fontSize: '1.05rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  versionLine: {
    color: theme.palette.text.secondary,
    fontFamily:
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  },
  body: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    padding: theme.spacing(2, 2.5),
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
 * Styles for the environments list grid layout
 */
export const useEnvironmentsListStyles = makeStyles(theme => ({
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(275px, 1fr))',
    gap: theme.spacing(3),
    alignItems: 'stretch',
  },
  cardItem: {
    display: 'flex',
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
