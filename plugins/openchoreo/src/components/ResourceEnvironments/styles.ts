import { makeStyles } from '@material-ui/core/styles';

/**
 * Split-pane container for the Deploy tab. Canvas on the left, detail
 * panel on the right. Mirrors Component's deploy layout but without the
 * setup-node row; resources don't have a workload-config concept.
 */
export const useResourceDeployFlowCanvasStyles = makeStyles(theme => ({
  splitContainer: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 380px',
    gridTemplateRows: 'minmax(0, 1fr)',
    gap: theme.spacing(2),
    width: '100%',
    height: 'calc(100vh - 200px)',
    minHeight: 480,
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: '1fr',
      gridTemplateRows: 'auto',
      gridAutoRows: 'min-content',
      height: 'auto',
    },
  },
  canvasFrame: {
    position: 'relative',
    width: '100%',
    height: '100%',
    minHeight: 0,
    backgroundColor: theme.palette.background.default,
    backgroundImage: 'var(--canvas-dots)',
    backgroundSize: '16px 16px',
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
    '&:active': { cursor: 'grabbing' },
  },
  canvasContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    transformOrigin: '0 0',
  },
  nodeWrapper: { position: 'absolute' },
  controlsOverlay: {
    position: 'absolute',
    bottom: theme.spacing(2),
    right: theme.spacing(2),
    zIndex: 2,
  },
  detailPanelFrame: {
    minHeight: 0,
    overflow: 'auto',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 12,
    backgroundColor: theme.palette.background.paper,
  },
}));

/**
 * Per-env compact node tile shown on the canvas. Width/height come from
 * the MINI_ENV_NODE_* constants in @openchoreo/backstage-plugin-react so
 * the dagre layout reserves the correct space.
 */
export const useResourceMiniEnvironmentNodeStyles = makeStyles(theme => ({
  tile: {
    width: '100%',
    height: '100%',
    padding: theme.spacing(1.5),
    borderRadius: 8,
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    cursor: 'pointer',
    transition: 'border-color 120ms, box-shadow 120ms',
    '&:hover': {
      borderColor: theme.palette.primary.light,
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 2,
    },
  },
  selected: {
    borderColor: theme.palette.primary.main,
    boxShadow: `0 0 0 2px ${theme.palette.primary.light}`,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
  },
  envName: {
    fontWeight: 600,
    fontSize: '0.95rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  release: {
    fontFamily: 'monospace',
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  meta: {
    fontSize: '0.7rem',
    color: theme.palette.text.hint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  empty: {
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
    fontSize: '0.8rem',
  },
  driftBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 6px',
    borderRadius: 4,
    fontSize: '0.65rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    backgroundColor: theme.palette.warning.light,
    color: theme.palette.warning.dark,
  },
}));

/**
 * Right-pane detail view. Internal scroll when content overflows the
 * fixed split-container height.
 */
export const useResourceEnvironmentDetailPanelStyles = makeStyles(theme => ({
  panel: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(2, 3),
    borderBottom: `1px solid ${theme.palette.divider}`,
    gap: theme.spacing(2),
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    minWidth: 0,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexShrink: 0,
  },
  envName: { fontWeight: 600 },
  body: {
    padding: theme.spacing(2, 3),
    overflow: 'auto',
    flex: 1,
  },
  section: { marginBottom: theme.spacing(3) },
  sectionHeading: {
    fontWeight: 500,
    marginBottom: theme.spacing(1),
  },
  metaRow: {
    display: 'grid',
    gridTemplateColumns: '140px 1fr',
    gap: theme.spacing(2),
    padding: theme.spacing(0.5, 0),
    alignItems: 'baseline',
  },
  metaLabel: {
    color: theme.palette.text.hint,
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaValue: {
    fontFamily: 'monospace',
    fontSize: '0.875rem',
    wordBreak: 'break-all',
  },
  actionsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
  emptyHero: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
    padding: theme.spacing(4),
    textAlign: 'center',
  },
  releaseValueRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  driftBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: '0.7rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    backgroundColor: theme.palette.warning.light,
    color: theme.palette.warning.dark,
  },
}));
