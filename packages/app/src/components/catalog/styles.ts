import { makeStyles } from '@material-ui/core/styles';

export const useStyles = makeStyles(theme => ({
  root: {
    width: '100%',
    maxWidth: 1200,
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
  },
  createButton: {
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(1, 1.5),
      fontSize: '0.875rem',
    },
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
    paddingBottom: theme.spacing(4),
    [theme.breakpoints.down('sm')]: {
      display: 'none', // Hide on mobile, will show in drawer
    },
  },
  filterDrawer: {
    [theme.breakpoints.up('md')]: {
      display: 'none',
    },
  },
  filterDrawerContent: {
    width: 250,
    padding: theme.spacing(2),
  },
  filterGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: theme.spacing(2),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: '1fr',
      gap: theme.spacing(1),
    },
  },
  filterItem: {
    display: 'flex',
    flexDirection: 'column',
    '& > div': {
      flex: 1,
    },
    [theme.breakpoints.down('sm')]: {
      marginBottom: theme.spacing(0.5),
    },
  },
  advancedFiltersToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: 0,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: theme.palette.primary.main,
    fontWeight: 400,
    fontSize: '0.875rem',
    '&:hover': {
      textDecoration: 'underline',
    },
    [theme.breakpoints.down('sm')]: {
      display: 'none', // Hide on mobile
    },
  },
  advancedFiltersIcon: {
    transition: theme.transitions.create('transform', {
      duration: theme.transitions.duration.shortest,
    }),
  },
  advancedFiltersExpanded: {
    transform: 'rotate(180deg)',
  },
  contentArea: {
    flex: 1,
  },
  hideWhenEmpty: {
    '&:empty': {
      display: 'none',
    },
  },
}));

export const usePersonalFilterStyles = makeStyles(theme => ({
  container: {
    display: 'flex',
    marginTop: theme.spacing(2.5),
  },
  filterItem: {
    flex: 1,
    padding: theme.spacing(1.2),
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.grey[200]}`,
    borderRadius: theme.spacing(1),
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    cursor: 'pointer',
    transition: 'border-color 0.2s ease-in-out',
  },
  checkbox: {
    padding: 0,
    marginTop: theme.spacing(0.25),
  },
  contentContainer: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
  },
  labelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
  },
  icon: {
    fontSize: '1.25rem',
    color: theme.palette.primary.main,
  },
  label: {
    color: theme.palette.text.primary,
    margin: 0,
  },
  countBadge: {
    marginLeft: 'auto',
    padding: theme.spacing(0.4, 0.8),
    backgroundColor: theme.palette.grey[100],
    borderRadius: theme.shape.borderRadius,
    fontSize: '0.8rem',
    fontWeight: 600,
    color: theme.palette.text.secondary,
    justifyContent: 'center',
    textAlign: 'center',
    minWidth: theme.spacing(3),
  },
}));

export const useCardListStyles = makeStyles(theme => ({
  searchAndTitle: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
  },
  titleText: {
    fontSize: '1rem',
    fontWeight: 600,
    color: theme.palette.text.primary,
  },
  listContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: theme.spacing(1.5),
  },
  entityCard: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(1.5, 2),
    border: `1px solid ${theme.palette.grey[100]}`,
    borderRadius: 10,
    backgroundColor: theme.palette.background.paper,
    transition: 'box-shadow 0.2s ease-in-out',
    '&:hover': {
      boxShadow: theme.shadows[2],
    },
  },
  iconContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing(1.5),
    color: theme.palette.text.secondary,
    '& svg': {
      fontSize: '1.5rem',
    },
  },
  contentContainer: {
    flex: 1,
    minWidth: 0,
  },
  entityName: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: theme.palette.text.primary,
    '& a': {
      color: 'inherit',
      textDecoration: 'none',
      '&:hover': {
        textDecoration: 'underline',
      },
    },
  },
  entityNameDisabled: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: theme.palette.text.disabled,
  },
  description: {
    fontSize: '0.85rem',
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(0.25),
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  actionsContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    marginLeft: theme.spacing(1),
    flexShrink: 0,
  },
  paginationContainer: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: theme.spacing(2),
  },
  emptyState: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing(6),
    color: theme.palette.text.secondary,
    fontSize: '0.95rem',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    padding: theme.spacing(6),
  },
}));
