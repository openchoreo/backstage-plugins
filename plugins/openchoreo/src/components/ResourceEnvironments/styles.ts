import { makeStyles } from '@material-ui/core/styles';
import { alpha } from '@material-ui/core/styles/colorManipulator';

/**
 * Split-pane container for the Deploy tab. Canvas on the left, detail
 * panel on the right. Mirrors Component's deploy layout.
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
  detailPanelFrame: {
    minHeight: 0,
    overflow: 'auto',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 12,
    backgroundColor: theme.palette.background.paper,
  },
}));

/**
 * Compact `Set up` tile shown as the leftmost node on the deploy canvas.
 * Width/height come from MINI_SETUP_NODE_* constants in
 * @openchoreo/backstage-plugin-react so the dagre layout reserves the
 * correct space.
 */
export const useResourceSetupCardCompactStyles = makeStyles(theme => ({
  setupCard: {
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    padding: theme.spacing(2),
    borderRadius: 12,
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    border: `1px dashed ${theme.palette.divider}`,
    gap: theme.spacing(0.75),
    cursor: 'pointer',
    transition: 'box-shadow 120ms ease, border-color 120ms ease',
    '&:hover': {
      boxShadow: theme.shadows[3],
    },
  },
  cardSelected: {
    borderColor: theme.palette.primary.main,
    borderStyle: 'solid',
    backgroundColor: alpha(
      theme.palette.primary.main,
      theme.palette.type === 'dark' ? 0.12 : 0.04,
    ),
    boxShadow: `0 0 0 2px ${theme.palette.primary.main}, ${theme.shadows[4]}`,
    '&:hover': {
      boxShadow: `0 0 0 2px ${theme.palette.primary.main}, ${theme.shadows[4]}`,
    },
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
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
  hint: {
    color: theme.palette.text.secondary,
    fontSize: '0.78rem',
    textAlign: 'center',
  },
}));

/**
 * Per-env compact node tile shown on the canvas. Layout: a vertical
 * status stripe on the left whose color reflects the binding status,
 * a body with icon + name + 3-dot menu (top), STATUS: row, and a
 * DEPLOYED: relative-time row on bound envs.
 *
 * Width/height come from MINI_ENV_NODE_* in
 * @openchoreo/backstage-plugin-react so the dagre layout reserves the
 * correct space.
 */
export const useResourceMiniEnvironmentNodeStyles = makeStyles(theme => ({
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
    borderColor: theme.palette.primary.main,
    backgroundColor: theme.palette.background.paper,
    backgroundImage: `linear-gradient(${alpha(
      theme.palette.primary.main,
      theme.palette.type === 'dark' ? 0.12 : 0.04,
    )}, ${alpha(
      theme.palette.primary.main,
      theme.palette.type === 'dark' ? 0.12 : 0.04,
    )})`,
    boxShadow: `0 0 0 2px ${theme.palette.primary.main}, ${theme.shadows[4]}`,
    '&:hover': {
      boxShadow: `0 0 0 2px ${theme.palette.primary.main}, ${theme.shadows[4]}`,
    },
  },
  statusStripe: {
    width: 4,
    height: '100%',
    flexShrink: 0,
  },
  statusStripeActive: {
    backgroundColor: theme.palette.success.main,
  },
  statusStripePending: {
    backgroundColor: theme.palette.warning.main,
  },
  statusStripeFailed: {
    backgroundColor: theme.palette.error.main,
  },
  statusStripeIdle: {
    backgroundColor: theme.palette.action.disabled,
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
  nameWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    minWidth: 0,
    flex: 1,
  },
  kindIcon: {
    color: theme.palette.text.secondary,
    fontSize: '1rem',
    flexShrink: 0,
  },
  envName: {
    fontWeight: 600,
    fontSize: '0.95rem',
    lineHeight: 1.2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  menuButton: {
    padding: theme.spacing(0.25),
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(0.75),
    rowGap: theme.spacing(0.5),
    color: theme.palette.text.secondary,
    fontSize: '0.8rem',
    minWidth: 0,
  },
  meta: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: theme.palette.text.secondary,
    fontSize: '0.65rem',
    fontWeight: 500,
    flexShrink: 0,
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
    gap: theme.spacing(0.75),
    flexWrap: 'wrap',
  },
  primaryButton: {
    textTransform: 'none',
  },
  driftBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 2,
    fontSize: '0.7rem',
    fontWeight: 500,
    color: theme.palette.warning.dark,
    backgroundColor: alpha(theme.palette.warning.main, 0.16),
    borderRadius: 4,
    padding: theme.spacing(0.1, 0.5),
    whiteSpace: 'nowrap',
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
    padding: theme.spacing(2, 2.5),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  headerTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
  },
  headerNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    minWidth: 0,
    flex: 1,
  },
  headerKindIcon: {
    color: theme.palette.text.secondary,
    flexShrink: 0,
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
  body: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  setupHeader: {
    padding: theme.spacing(2, 2.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  setupBody: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    padding: theme.spacing(2, 2.5),
    display: 'flex',
    flexDirection: 'column',
  },
  section: {
    padding: theme.spacing(2, 2.5),
    borderTop: `1px solid ${theme.palette.divider}`,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  sectionHeading: {
    fontWeight: 600,
    color: theme.palette.text.primary,
    fontSize: '0.78rem',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionTitleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
  },
  statusMessage: {
    color: theme.palette.text.primary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 280,
    flex: 1,
  },
  actionsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
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
  releaseNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  },
  releaseNameLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: theme.palette.text.secondary,
    fontSize: '0.65rem',
    flexShrink: 0,
  },
  releaseName: {
    fontFamily:
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    color: theme.palette.text.primary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 280,
  },
  deployedRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: theme.spacing(0.75),
  },
  dangerAccordion: {
    border: `1px solid ${alpha(theme.palette.error.main, 0.4)}`,
    borderRadius: 4,
    boxShadow: 'none',
    backgroundColor: alpha(theme.palette.error.main, 0.04),
    '&:before': { display: 'none' },
    '&.Mui-expanded': { margin: 0 },
  },
  dangerAccordionSummary: {
    minHeight: 40,
    '&.Mui-expanded': { minHeight: 40 },
    '& .MuiAccordionSummary-content': {
      margin: 0,
      alignItems: 'center',
    },
    '& .MuiAccordionSummary-content.Mui-expanded': { margin: 0 },
  },
  dangerAccordionIcon: {
    color: theme.palette.error.dark,
    marginRight: theme.spacing(1),
  },
  dangerAccordionTitle: {
    fontWeight: 600,
    color: theme.palette.error.dark,
  },
  dangerAccordionDetails: {
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  dangerSubsection: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.75),
  },
  dangerCaption: {
    color: theme.palette.text.secondary,
    fontWeight: 500,
  },
  dangerHelp: {
    color: theme.palette.text.hint,
  },
  dangerButton: {
    color: theme.palette.error.main,
    borderColor: theme.palette.error.main,
    alignSelf: 'flex-start',
    '&:hover': {
      borderColor: theme.palette.error.dark,
      backgroundColor: theme.palette.action.hover,
    },
  },
}));
