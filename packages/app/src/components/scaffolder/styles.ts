import { makeStyles } from '@material-ui/core/styles';

export const useStyles = makeStyles(theme => ({
  root: {
    width: '100%',
    paddingLeft: theme.spacing(2),
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
  },
  filterButton: {
    display: 'none !important',
    gap: theme.spacing(0.5),
    alignItems: 'center',
    background: 'none !important',
    border: 'none !important',
    padding: '0 !important',
    cursor: 'pointer !important',
    [theme.breakpoints.down('sm')]: {
      display: 'flex !important',
    },
  },
  filterButtonText: {
    fontSize: '0.875rem',
    fontWeight: 500,
  },
  filterSection: {
    paddingBottom: theme.spacing(3),
    [theme.breakpoints.down('sm')]: {
      display: 'none',
    },
    marginBottom: theme.spacing(2),
  },
  filterRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: theme.spacing(2),
    flexWrap: 'wrap',
    rowGap: theme.spacing(2),
  },
  searchBar: {
    flex: '1 1 180px',
    maxWidth: 320,
  },
  categoryFilter: {
    flex: '0 1 240px',
    minWidth: 180,
  },
  tagFilter: {
    flex: '0 1 240px',
    minWidth: 180,
    '&:empty': {
      display: 'none',
    },
  },
  starredFilter: {
    flex: '0 0 auto',
    minWidth: 180,
    alignSelf: 'flex-end',
  },
  filterDrawer: {
    [theme.breakpoints.up('md')]: {
      display: 'none',
    },
  },
  filterDrawerContent: {
    width: 280,
    padding: theme.spacing(2),
  },
  filterGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  filterItem: {
    '& > div': {
      width: '100%',
    },
  },
  contentArea: {
    flex: 1,
    // marginLeft: -24,
  },
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    color: theme.palette.text.primary,
    marginBottom: theme.spacing(2),
    marginTop: theme.spacing(4),
  },
  sectionTitleFirst: {
    marginTop: 0,
  },
  sectionSubtitle: {
    fontSize: '0.875rem',
    fontWeight: 500,
    marginBottom: theme.spacing(2),
    marginTop: theme.spacing(3),
  },
  // Shared card base
  cardBase: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 180,
    borderRadius: 12,
    backgroundColor: theme.palette.background.paper,
    border: '1px solid #f3f4f6',
    boxShadow:
      'rgba(0, 0, 0, 0.05) 0px 1px 3px 0px, rgba(0, 0, 0, 0.03) 0px 1px 2px 0px',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    padding: theme.spacing(3),
    '&:hover': {
      borderColor: theme.palette.primary.main,
      boxShadow: theme.shadows[4],
      transform: 'translateY(-2px)',
    },
  },
  // Centered icon + label card layout
  resourceCard: {
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  resourceCardIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.palette.primary.main,
    fontSize: 36,
    marginBottom: theme.spacing(1.5),
  },
  resourceCardTitle: {
    fontSize: '0.938rem',
    fontWeight: 600,
    color: theme.palette.text.primary,
    lineHeight: 1.4,
  },
  resourceCardDescription: {
    fontSize: '0.813rem',
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(0.5),
    lineHeight: 1.4,
  },
  workloadTypeBadge: {
    position: 'absolute',
    top: theme.spacing(1),
    left: theme.spacing(1.5),
    fontSize: '0.65rem',
    fontWeight: 600,
    color: theme.palette.primary.main,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  starButton: {
    position: 'absolute',
    top: theme.spacing(1),
    right: theme.spacing(1),
    padding: theme.spacing(0.5),
    color: theme.palette.text.disabled,
    '&:hover': {
      color: '#f3ba37',
    },
  },
  starButtonActive: {
    color: '#f3ba37',
  },
  templateCardFooter: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.75),
    marginTop: theme.spacing(2),
  },
  templateCardChip: {
    height: 24,
    fontSize: '0.75rem',
  },
  namespaceChip: {
    height: 22,
    fontSize: '0.7rem',
    marginTop: theme.spacing(0.75),
    color: theme.palette.text.secondary,
    borderColor: theme.palette.divider,
  },
  cardDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
    pointerEvents: 'none' as const,
    '&:hover': {
      borderColor: 'inherit',
      boxShadow:
        'rgba(0, 0, 0, 0.05) 0px 1px 3px 0px, rgba(0, 0, 0, 0.03) 0px 1px 2px 0px',
      transform: 'none',
    },
  },
  cardDisabledWrapper: {
    cursor: 'not-allowed',
  },
  backButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    color: theme.palette.primary.main,
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: 500,
    marginBottom: theme.spacing(2),
    background: 'none',
    border: 'none',
    padding: 0,
    '&:hover': {
      textDecoration: 'underline',
    },
  },
}));
