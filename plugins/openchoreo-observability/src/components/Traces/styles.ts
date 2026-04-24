import { makeStyles, Theme } from '@material-ui/core/styles';

export const useTracesActionsStyles = makeStyles((theme: Theme) => ({
  statsContainer: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionsContainer: {
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'center',
  },
}));

export const useTracesTableStyles = makeStyles((theme: Theme) => ({
  tablePaper: {
    marginBottom: theme.spacing(0),
    paddingBottom: theme.spacing(1),
  },
  tableContainer: {
    maxHeight: 'calc(100vh - 320px)',
    overflowY: 'auto',
    overflowX: 'hidden',
    width: '100%',
  },
  table: {
    width: '100%',
    tableLayout: 'fixed',
  },
  headerCell: {
    fontWeight: 'bold',
    backgroundColor: theme.palette.background.paper,
    position: 'sticky',
    top: 0,
    zIndex: 1,
    fontSize: '0.75rem',
    padding: '4px 8px !important',
  },
  traceRow: {
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
    '& > td': {
      padding: '4px 8px !important',
      fontSize: '0.75rem',
    },
  },
  expandedRow: {
    backgroundColor: theme.palette.action.selected,
  },
  traceCell: {
    fontSize: '0.75rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  traceIdCell: {
    fontSize: '0.75rem',
    fontFamily: 'monospace',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing(4),
    color: theme.palette.text.secondary,
  },
  expandIcon: {
    cursor: 'pointer',
    padding: 0,
    '& .MuiSvgIcon-root': {
      fontSize: '1rem',
    },
  },
  errorRow: {
    '& > td:first-child, & > th:first-child': {
      position: 'relative',
      borderLeft: 'none !important',
      '&::before': {
        content: '""',
        position: 'absolute',
        left: 0,
        top: '5%',
        bottom: '5%',
        width: '3px',
        backgroundColor: '#EF4444',
        borderRadius: '2px',
      },
    },
  },
  errorStripe: {
    position: 'absolute',
    left: 0,
    top: '5%',
    bottom: '5%',
    width: '8px',
    cursor: 'default',
    zIndex: 1,
  },
}));

export const useWaterfallStyles = makeStyles((theme: Theme) => ({
  container: {
    padding: theme.spacing(2),
    backgroundColor:
      theme.palette.type === 'dark'
        ? theme.palette.background.default
        : '#fafafa',
    overflowX: 'auto',
  },
  timeline: {
    position: 'relative',
    marginTop: theme.spacing(1),
  },
  spanRow: {
    position: 'relative',
    marginBottom: theme.spacing(1),
    minHeight: '30px',
    display: 'flex',
    alignItems: 'center',
  },
  spanLabel: {
    width: '250px',
    minWidth: '250px',
    maxWidth: '250px',
    paddingRight: theme.spacing(1),
    fontSize: '0.875rem',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  collapseButton: {
    padding: 0,
    width: '20px',
    height: '20px',
    '& .MuiSvgIcon-root': {
      fontSize: '1rem',
    },
  },
  spanBarContainer: {
    position: 'relative',
    flex: 1,
    height: '24px',
    marginLeft: theme.spacing(1),
  },
  spanBar: {
    position: 'absolute',
    height: '20px',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
    display: 'flex',
    alignItems: 'center',
    paddingLeft: theme.spacing(1),
    paddingRight: theme.spacing(1),
    fontSize: '0.75rem',
    fontWeight: 500,
    // Span bar background colors are pastel, designed for dark-on-light text
    // in both modes. Force dark text regardless of theme mode.
    color: 'rgba(0, 0, 0, 0.87)',
    '&:hover': {
      opacity: 0.8,
      zIndex: 10,
    },
  },
  tooltipContent: {
    padding: theme.spacing(1),
    minWidth: '280px',
    maxWidth: '450px',
    color: '#fff',
  },
  tooltipRow: {
    marginBottom: theme.spacing(0.5),
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
    '&:last-child': {
      marginBottom: 0,
    },
  },
  tooltipLabel: {
    fontWeight: 600,
    color: '#fff',
    fontSize: '0.75rem',
    minWidth: '85px',
    flexShrink: 0,
  },
  spanErrorIcon: {
    color: '#F87171',
    fontSize: '0.875rem',
    flexShrink: 0,
  },
}));
