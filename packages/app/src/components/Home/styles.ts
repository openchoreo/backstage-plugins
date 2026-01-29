import { makeStyles } from '@material-ui/core/styles';

export const useStyles = makeStyles(theme => ({
  searchSection: {
    display: 'flex',
    marginBottom: theme.spacing(4),
    justifyContent: 'center',
    width: '100%',
  },
  searchPaper: {
    padding: theme.spacing(1.5, 3), // More generous padding
    display: 'flex',
    alignItems: 'center',
    width: theme.spacing(100),
    backgroundColor: theme.palette.background.paper,
    border: `2px solid ${theme.palette.grey[200]}`, // Slightly thicker, lighter border
    borderRadius: theme.spacing(6), // Less extreme rounding for modern look
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)', // Subtle shadow
    '&:hover': {
      borderColor: theme.palette.primary.light,
      boxShadow:
        '0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.04)',
      transform: 'translateY(-1px)',
    },
    '&:focus-within': {
      borderColor: theme.palette.primary.main,
      boxShadow: `0 0 0 3px ${theme.palette.primary.main}20, 0 4px 6px -1px rgba(0, 0, 0, 0.08)`,
    },
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: '1rem',
    color: theme.palette.text.secondary,
    marginLeft: theme.spacing(1),
    cursor: 'pointer',
  },
  searchModal: {
    '& .MuiDialog-paper': {
      borderRadius: theme.shape.borderRadius * 2,
      maxHeight: '80vh',
    },
  },
  searchModalContent: {
    padding: theme.spacing(2),
    paddingBottom: theme.spacing(1),
  },
  searchModalHeader: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
    '& .MuiInputBase-root': {
      flex: 1,
      backgroundColor: theme.palette.background.default,
      borderRadius: theme.shape.borderRadius,
      padding: theme.spacing(1, 2),
    },
  },
  searchModalClose: {
    cursor: 'pointer',
    color: theme.palette.text.secondary,
    '&:hover': {
      color: theme.palette.text.primary,
    },
  },
  searchModalResults: {
    maxHeight: '60vh',
    overflow: 'auto',
    '& .MuiList-root': {
      padding: 0,
    },
    '& .MuiListItem-root': {
      borderRadius: theme.shape.borderRadius,
      marginBottom: theme.spacing(0.5),
      '&:hover': {
        backgroundColor: theme.palette.action.hover,
      },
    },
  },
  overviewSection: {
    marginBottom: theme.spacing(4),
  },
  widgetContainer: {
    display: 'flex',
    gap: theme.spacing(4), // Increased from 3 to 4 for more breathing room
    marginTop: theme.spacing(4), // Increased from 3 to 4
    flexWrap: 'wrap',
    '& > *': {
      flex: '1 1 300px',
      minWidth: '300px',
    },
    [theme.breakpoints.down('sm')]: {
      flexDirection: 'column',
      '& > *': {
        flex: '1 1 auto',
        minWidth: 'auto',
      },
    },
  },
  platformDetailsSection: {
    marginBottom: theme.spacing(4),
  },
  starredEntitiesWrapper: {
    height: '100%',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    '& > div': {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
    },
    '& .MuiCard-root, & .MuiPaper-root': {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
    },
  },
  quickActionsContainer: {
    marginTop: theme.spacing(3),
  },
  quickActionCard: {
    height: '100%',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.spacing(1),
    transition: 'all 0.2s ease-in-out',
    '&:hover': {
      borderColor: theme.palette.primary.main,
      boxShadow: theme.shadows[4],
      transform: 'translateY(-2px)',
    },
  },
  quickActionCardAction: {
    height: '100%',
    display: 'flex',
    alignItems: 'flex-start',
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'none',
    },
  },
  quickActionCardContent: {
    width: '100%',
    padding: theme.spacing(4), // Increased from 3 to 4 for more internal spacing
  },
  quickActionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(1),
  },
  quickActionTitle: {
    fontWeight: 600,
  },
  quickActionIcon: {
    color: theme.palette.text.secondary,
    opacity: 0.6,
  },
  searchBarInput: {
    maxWidth: '60vw',
    margin: 'auto',
    backgroundColor: theme.palette.background.paper,
    borderRadius: '50px',
    boxShadow: theme.shadows[1],
  },
  searchBarOutline: {
    borderStyle: 'none',
  },
  welcomeCard: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  groupBadge: {
    display: 'inline-block',
    padding: '6px 14px', // More generous padding
    margin: '4px',
    borderRadius: '16px', // More rounded
    backgroundColor: `${theme.palette.primary.light}30`, // Softer, translucent background
    color: theme.palette.primary.dark,
    fontSize: '0.875rem',
    fontWeight: 500,
    border: `1px solid ${theme.palette.primary.light}60`,
  },
}));
