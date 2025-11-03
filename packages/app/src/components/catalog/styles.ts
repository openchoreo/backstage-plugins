import { makeStyles } from '@material-ui/core/styles';

export const useStyles = makeStyles(theme => ({
  root: {
    width: '100%',
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

