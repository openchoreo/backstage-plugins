import { makeStyles } from '@material-ui/core/styles';

export const useWirelogsStyles = makeStyles(theme => ({
  errorContainer: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    flexWrap: 'wrap',
    marginBottom: theme.spacing(2),
  },
  envControl: {
    width: 220,
    flexShrink: 0,
  },
  filterField: {
    flex: 1,
    minWidth: 260,
  },
  startButton: {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    whiteSpace: 'nowrap',
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
    },
  },
  stopButton: {
    backgroundColor: theme.palette.error.main,
    color: theme.palette.error.contrastText,
    whiteSpace: 'nowrap',
    '&:hover': {
      backgroundColor: theme.palette.error.dark,
    },
  },
  toolbarButton: {
    whiteSpace: 'nowrap',
    color: theme.palette.text.secondary,
    borderColor: theme.palette.divider,
  },
}));

export const useWirelogsStatsStyles = makeStyles(theme => ({
  container: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    margin: theme.spacing(1),
    flexWrap: 'wrap',
    gap: theme.spacing(2),
  },
  countLabel: {
    color: theme.palette.text.secondary,
  },
  metrics: {
    display: 'flex',
    gap: theme.spacing(3),
    alignItems: 'center',
  },
  allowed: {
    color: theme.palette.success.main,
  },
  dropped: {
    color: theme.palette.error.main,
  },
  ratioHigh: {
    color: theme.palette.success.main,
  },
  ratioMid: {
    color: theme.palette.warning.main,
  },
  ratioLow: {
    color: theme.palette.error.main,
  },
}));

export const useWirelogsTableStyles = makeStyles(theme => ({
  tablePaper: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    overflow: 'hidden',
  },
  tableContainer: {
    maxHeight: 'calc(100vh - 320px)',
    overflowY: 'auto',
    overflowX: 'auto',
  },
  headerCell: {
    fontWeight: 700,
    fontSize: '0.65rem',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: theme.palette.text.secondary,
    backgroundColor: theme.palette.background.default,
    position: 'sticky',
    top: 0,
    zIndex: 1,
    padding: theme.spacing(0.75, 1.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
    whiteSpace: 'nowrap',
  },
  row: {
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  rowSelected: {
    backgroundColor: theme.palette.action.selected,
  },
  bodyCell: {
    padding: theme.spacing(0.75, 1.5),
    verticalAlign: 'top',
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  timeCell: {
    fontFamily: 'monospace',
    fontSize: '11px',
    color: theme.palette.text.primary,
    whiteSpace: 'nowrap',
  },
  verdictChip: {
    fontSize: '0.6rem',
    fontWeight: 'bold',
    height: '18px !important',
    '& .MuiChip-label': {
      display: 'flex',
      alignItems: 'center',
      padding: '0 6px',
    },
  },
  verdictForwardedChip: {
    backgroundColor: theme.palette.success.light,
    color: theme.palette.success.dark,
    outline: `1px solid ${theme.palette.success.main}`,
  },
  verdictDroppedChip: {
    backgroundColor: theme.palette.error.light,
    color: theme.palette.error.dark,
    outline: `1px solid ${theme.palette.error.main}`,
  },
  verdictUnknownChip: {
    backgroundColor: theme.palette.action.disabledBackground,
    color: theme.palette.text.disabled,
    outline: `1px solid ${theme.palette.text.secondary}`,
  },
  verdictDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    display: 'inline-block',
    marginRight: theme.spacing(0.5),
    backgroundColor: 'currentColor',
  },
  typeBadge: {
    display: 'inline-block',
    fontSize: '0.6rem',
    fontWeight: 700,
    letterSpacing: 0.3,
    padding: theme.spacing(0.1, 0.6),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.background.default,
    border: `1px solid ${theme.palette.divider}`,
    color: theme.palette.text.secondary,
    whiteSpace: 'nowrap',
  },
  dirCell: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    fontSize: '11px',
    color: theme.palette.text.secondary,
    whiteSpace: 'nowrap',
  },
  dirArrow: {
    fontSize: '0.9rem',
    lineHeight: 1,
  },
  endpointName: {
    color: theme.palette.primary.main,
    fontFamily: 'monospace',
    fontSize: '11px',
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 200,
  },
  endpointSub: {
    color: theme.palette.text.secondary,
    fontSize: '0.65rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 200,
  },
  summaryCell: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    fontSize: '11px',
    color: theme.palette.text.primary,
    whiteSpace: 'nowrap',
  },
  summaryArrow: {
    color: theme.palette.text.secondary,
    fontSize: '0.85rem',
  },
  summaryText: {
    fontFamily: 'monospace',
    fontSize: '11px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 220,
  },
  methodBadge: {
    fontSize: '0.6rem',
    fontWeight: 700,
    fontFamily: 'monospace',
    padding: theme.spacing(0.1, 0.6),
    borderRadius: theme.shape.borderRadius,
  },
  methodGet: {
    backgroundColor: theme.palette.success.light,
    color: theme.palette.success.dark,
  },
  methodPost: {
    backgroundColor: theme.palette.info.light,
    color: theme.palette.info.dark,
  },
  methodPut: {
    backgroundColor: theme.palette.warning.light,
    color: theme.palette.warning.dark,
  },
  methodDelete: {
    backgroundColor: theme.palette.error.light,
    color: theme.palette.error.dark,
  },
  methodOther: {
    backgroundColor: theme.palette.action.selected,
    color: theme.palette.text.primary,
  },
  statusCode: {
    fontFamily: 'monospace',
    fontWeight: 700,
  },
  status2xx: {
    color: theme.palette.success.main,
  },
  status3xx: {
    color: theme.palette.info.main,
  },
  status4xx: {
    color: theme.palette.warning.main,
  },
  status5xx: {
    color: theme.palette.error.main,
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing(6),
    color: theme.palette.text.secondary,
  },
}));

export const useWirelogsDetailStyles = makeStyles(theme => ({
  tabs: {
    minHeight: 36,
    marginTop: theme.spacing(1),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  tab: {
    minHeight: 36,
    minWidth: 'auto',
    textTransform: 'none',
    fontSize: '0.8rem',
    padding: theme.spacing(0, 1.5),
  },
  tabPanel: {
    paddingTop: theme.spacing(2),
  },
  section: {
    marginBottom: theme.spacing(2.5),
  },
  sectionTitle: {
    fontSize: '0.68rem',
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1),
  },
  endpointsGrid: {
    display: 'flex',
    alignItems: 'stretch',
    gap: theme.spacing(1),
  },
  endpointCard: {
    flex: 1,
    minWidth: 0,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(1.5),
    backgroundColor: theme.palette.background.paper,
  },
  endpointCardLabel: {
    fontSize: '0.62rem',
    fontWeight: 700,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: theme.palette.text.secondary,
  },
  endpointCardTitle: {
    fontFamily: 'monospace',
    fontSize: '0.85rem',
    fontWeight: 700,
    color: theme.palette.primary.main,
    marginBottom: theme.spacing(1),
    wordBreak: 'break-all',
  },
  endpointArrow: {
    display: 'flex',
    alignItems: 'center',
    color: theme.palette.text.secondary,
  },
  kvRow: {
    display: 'flex',
    gap: theme.spacing(1),
    padding: theme.spacing(0.25, 0),
    fontSize: '0.78rem',
  },
  kvKey: {
    color: theme.palette.text.secondary,
    minWidth: 84,
    flexShrink: 0,
  },
  kvValue: {
    color: theme.palette.text.primary,
    fontFamily: 'monospace',
    wordBreak: 'break-all',
  },
  droppedBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    backgroundColor: theme.palette.error.light,
    color: theme.palette.error.dark,
    border: `1px solid ${theme.palette.error.main}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(1, 1.5),
    marginBottom: theme.spacing(2),
    fontSize: '0.82rem',
    fontWeight: 600,
  },
  headersList: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    overflow: 'hidden',
  },
  headerRow: {
    display: 'flex',
    gap: theme.spacing(2),
    padding: theme.spacing(0.75, 1.5),
    fontSize: '0.78rem',
    borderBottom: `1px solid ${theme.palette.divider}`,
    '&:last-child': {
      borderBottom: 'none',
    },
  },
  headerKey: {
    color: theme.palette.text.primary,
    fontFamily: 'monospace',
    fontWeight: 600,
    minWidth: 160,
    flexShrink: 0,
  },
  headerValue: {
    color: theme.palette.text.primary,
    fontFamily: 'monospace',
    wordBreak: 'break-all',
  },
  emptyTab: {
    fontSize: '0.82rem',
    color: theme.palette.text.secondary,
    padding: theme.spacing(2, 0),
  },
  rawHeader: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: theme.spacing(1),
  },
  rawCopyButton: {
    fontSize: '0.72rem',
    textTransform: 'none',
    color: theme.palette.text.secondary,
    padding: theme.spacing(0.25, 0.75),
    minWidth: 'auto',
  },
}));

export const useWirelogsDrawerStyles = makeStyles(theme => ({
  drawer: {
    width: 820,
    maxWidth: '100vw',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
    padding: theme.spacing(2, 2, 1),
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
    minWidth: 0,
  },
  headerIcon: {
    color: theme.palette.text.secondary,
    marginTop: 2,
  },
  title: {
    fontWeight: 700,
    fontSize: '0.95rem',
    fontFamily: 'monospace',
    color: theme.palette.text.primary,
    wordBreak: 'break-all',
  },
  uuid: {
    fontSize: '0.72rem',
    fontFamily: 'monospace',
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(0.5),
    wordBreak: 'break-all',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    flexShrink: 0,
  },
  metadataRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
    padding: theme.spacing(0, 2, 1.5),
  },
  verdictChip: {
    fontSize: '0.6rem',
    fontWeight: 'bold',
    height: '20px !important',
  },
  verdictForwardedChip: {
    backgroundColor: theme.palette.success.light,
    color: theme.palette.success.dark,
    outline: `1px solid ${theme.palette.success.main}`,
  },
  verdictDroppedChip: {
    backgroundColor: theme.palette.error.light,
    color: theme.palette.error.dark,
    outline: `1px solid ${theme.palette.error.main}`,
  },
  verdictUnknownChip: {
    backgroundColor: theme.palette.action.disabledBackground,
    color: theme.palette.text.disabled,
    outline: `1px solid ${theme.palette.text.secondary}`,
  },
  metaChip: {
    fontSize: '0.6rem',
    fontWeight: 600,
    height: '20px !important',
  },
  body: {
    flex: 1,
    overflow: 'auto',
    padding: theme.spacing(0, 2, 2),
  },
}));
