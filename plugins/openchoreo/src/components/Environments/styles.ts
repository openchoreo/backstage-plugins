import { makeStyles, alpha } from '@material-ui/core/styles';

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
    position: 'relative',
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
  startBadge: {
    position: 'absolute',
    top: theme.spacing(1),
    left: theme.spacing(1),
    padding: '1px 6px',
    borderRadius: 3,
    backgroundColor: alpha(theme.palette.primary.main, 0.15),
    // Use primary.dark instead of primary.main so the badge text passes
    // WCAG 2.2 AA on the alpha-blended background (~#e6e8f6).
    color: theme.palette.primary.dark,
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.08em',
    lineHeight: 1.4,
    textTransform: 'uppercase',
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
  cardError: {
    borderColor: theme.palette.error.main,
    borderStyle: 'solid',
    backgroundColor: alpha(theme.palette.error.main, 0.06),
  },
  errorMarker: {
    position: 'absolute',
    top: theme.spacing(1),
    right: theme.spacing(1),
    color: theme.palette.error.main,
    fontSize: '1.1rem',
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
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 0,
  },
  workloadButtonWrapper: {
    display: 'flex',
    justifyContent: 'center',
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
    borderColor: theme.palette.primary.main,
    // Layer the primary-tinted overlay on top of the opaque paper
    // background so the canvas's dotted background (radial-gradient)
    // doesn't bleed through the selected tile.
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
  name: {
    fontWeight: 600,
    fontSize: '0.95rem',
    lineHeight: 1.2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  // Real-button version of `.name` used to make the environment selectable
  // by keyboard without nesting interactive elements inside an outer button.
  nameButton: {
    background: 'none',
    border: 'none',
    padding: 0,
    margin: 0,
    cursor: 'pointer',
    color: 'inherit',
    font: 'inherit',
    textAlign: 'inherit',
    // <button> has an intrinsic min-content width; allow it to shrink in
    // the flex `nameWrap` so `text-overflow: ellipsis` can take effect on
    // long environment names.
    minWidth: 0,
    flex: '1 1 auto',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontWeight: 600,
    fontSize: '0.95rem',
    lineHeight: 1.2,
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 2,
      borderRadius: 2,
    },
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
  metaChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 2,
    fontSize: '0.7rem',
    fontWeight: 500,
    color: theme.palette.text.secondary,
    backgroundColor: alpha(theme.palette.text.primary, 0.06),
    borderRadius: 4,
    padding: theme.spacing(0.1, 0.5),
    whiteSpace: 'nowrap',
  },
  metaChipDanger: {
    color: theme.palette.error.dark,
    backgroundColor: alpha(theme.palette.error.main, 0.12),
  },
  metaLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: theme.palette.text.secondary,
    fontSize: '0.65rem',
    fontWeight: 500,
    flexShrink: 0,
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
    gap: theme.spacing(0.75),
    flexWrap: 'wrap',
  },
  menuButton: {
    // WCAG 2.2 SC 2.5.8 target-size: ensure ≥24x24 effective hit area.
    // With a 16px icon, 4px padding gives a 24x24 button.
    padding: theme.spacing(0.5),
    minWidth: 24,
    minHeight: 24,
  },
  primaryButton: {
    textTransform: 'none',
    // WCAG 2.2 SC 2.5.8 target-size for the small "Promote" button.
    minHeight: 24,
  },
}));

/**
 * Styles for the deploy split view (left canvas + right detail panel).
 */
export const useDeployFlowCanvasStyles = makeStyles(theme => ({
  splitContainer: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 380px',
    // Single row pinned to the container's full height. Without an
    // explicit gridTemplateRows the implicit row size is `auto`, which
    // would let either side push the row taller than the container
    // (panels grow when the danger zone expands or when more sections
    // appear). `minmax(0, 1fr)` lets the row track shrink to the
    // container, which combined with `min-height: 0` on the grid items
    // gives them genuine fixed height + internal scroll.
    gridTemplateRows: 'minmax(0, 1fr)',
    gap: theme.spacing(2),
    width: '100%',
    // Fixed height so neither side resizes when the user picks
    // different env tiles. The RHS body scrolls internally on overflow.
    // 200px ≈ catalog header (66px) + tab bar (~40px) + breadcrumb row
    // (~50px) + a small bottom margin. minHeight is a safety floor for
    // tiny viewports.
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
  /**
   * Subtle "refreshing" affordance pinned to the canvas's top-right, shown
   * during a background revalidation (revisit tab / poll / post-action
   * refetch). The nodes stay mounted underneath — now that responses are
   * cached, a refetch no longer blanks the Deploy tab. Anchored inside the
   * relatively-positioned canvasFrame so it tracks the diagram, not the
   * detail panel.
   */
  canvasRefetchOverlay: {
    position: 'absolute',
    top: theme.spacing(1),
    right: theme.spacing(1),
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.shadows[1],
    pointerEvents: 'none',
    zIndex: 5,
  },
  skeletonCanvasInner: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(3),
    padding: theme.spacing(4),
    flexWrap: 'wrap',
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
  detailPanelFrame: {
    height: '100%',
    minHeight: 0,
    overflow: 'hidden',
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
  deployedRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: theme.spacing(0.75),
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
  releaseNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    marginTop: theme.spacing(0.5),
  },
  releaseNameLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: theme.palette.text.secondary,
    fontSize: '0.65rem',
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
  driftRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginTop: theme.spacing(0.5),
  },
  driftLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    color: theme.palette.info.dark,
    flex: 1,
    minWidth: 0,
  },
  driftDiffButton: {
    textTransform: 'none',
    fontSize: '0.7rem',
    padding: theme.spacing(0, 0.75),
    minWidth: 'auto',
    height: 22,
  },
  body: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  setupBody: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    padding: theme.spacing(2, 2.5),
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
  section: {
    padding: theme.spacing(2, 2.5),
    borderTop: `1px solid ${theme.palette.divider}`,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  sectionTitleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
  },
  sectionTitle: {
    fontWeight: 600,
    color: theme.palette.text.primary,
    fontSize: '0.78rem',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  inlineUrlRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    minWidth: 0,
  },
  inlineUrlLabel: {
    fontWeight: 500,
    color: theme.palette.text.secondary,
    flexShrink: 0,
  },
  inlineUrl: {
    fontFamily:
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    color: theme.palette.primary.main,
    textDecoration: 'none',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
    flex: 1,
  },
  timeIcon: {
    fontSize: '1rem',
    color: theme.palette.text.secondary,
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
  },
  dangerAccordion: {
    marginTop: theme.spacing(2),
    border: `1px solid ${alpha(theme.palette.error.main, 0.4)}`,
    borderRadius: 4,
    boxShadow: 'none',
    backgroundColor: alpha(theme.palette.error.main, 0.04),
    '&:before': { display: 'none' },
  },
  dangerAccordionSummary: {
    minHeight: 40,
    '&.Mui-expanded': { minHeight: 40 },
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
