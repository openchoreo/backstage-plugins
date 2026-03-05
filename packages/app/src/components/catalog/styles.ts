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
    [theme.breakpoints.up('md')]: {
      display: 'none',
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
  advancedFiltersGridItem: {
    display: 'flex',
    alignItems: 'flex-end',
    paddingBottom: theme.spacing(1),
    [theme.breakpoints.down('sm')]: {
      display: 'none',
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

export const useCardListStyles = makeStyles(theme => {
  const mobileGrid = {
    gridTemplateColumns: '32px 1fr 60px',
  };

  return {
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
      gap: theme.spacing(0.75),
    },

    // Grid templates per kind — icon + actions fixed, rest spread evenly
    // Component: Icon | Name | Description | Namespace | Project | Type | Actions
    gridTemplateComponent: {
      gridTemplateColumns: '40px 1fr 1.5fr 1fr 1fr 1fr 80px',
      [theme.breakpoints.down('xs')]: mobileGrid,
    },
    // API: Icon | Name | Description | Namespace | Project | Component | Type | Actions
    gridTemplateApi: {
      gridTemplateColumns: '40px 1.2fr 2fr 0.8fr 0.8fr 0.8fr 0.7fr 80px',
      [theme.breakpoints.down('xs')]: mobileGrid,
    },
    // Environment: Icon | Name | Description | Namespace | Type | Actions
    gridTemplateEnvironment: {
      gridTemplateColumns: '40px 1fr 1.5fr 1fr 1fr 80px',
      [theme.breakpoints.down('xs')]: mobileGrid,
    },
    // Planes: Icon | Name | Description | Namespace | Agent | Actions
    gridTemplatePlane: {
      gridTemplateColumns: '40px 1fr 1.5fr 1fr 1fr 80px',
      [theme.breakpoints.down('xs')]: mobileGrid,
    },
    // Project/simple: Icon | Name | Description | Namespace | Actions
    gridTemplateSimple: {
      gridTemplateColumns: '40px 1fr 1.5fr 1fr 80px',
      [theme.breakpoints.down('xs')]: mobileGrid,
    },
    // Namespace/domain: Icon | Name | Description | Actions
    gridTemplateMinimal: {
      gridTemplateColumns: '40px 1fr 1.5fr 80px',
      [theme.breakpoints.down('xs')]: mobileGrid,
    },

    // Header row
    headerRow: {
      display: 'grid',
      alignItems: 'center',
      padding: theme.spacing(0, 2),
      columnGap: theme.spacing(2),
      [theme.breakpoints.down('xs')]: {
        display: 'none',
      },
    },
    headerCell: {
      fontSize: '0.7rem',
      fontWeight: 600,
      textTransform: 'uppercase' as const,
      color: theme.palette.text.secondary,
      letterSpacing: '0.05em',
    },

    // Entity row
    entityRow: {
      display: 'grid',
      alignItems: 'center',
      padding: theme.spacing(1, 2),
      columnGap: theme.spacing(2),
      minHeight: 44,
      border: `1px solid ${theme.palette.grey[100]}`,
      borderRadius: 6,
      backgroundColor: theme.palette.background.paper,
      cursor: 'pointer',
      userSelect: 'none',
      transition: 'background-color 0.15s ease-in-out',
      '&:hover': {
        backgroundColor: theme.palette.grey[100],
      },
    },

    // Cell styles
    iconCell: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: theme.palette.text.secondary,
      '& svg': {
        fontSize: '1.25rem',
      },
    },
    nameCell: {
      minWidth: 0,
    },
    actionsCell: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      '& > :first-child': {
        marginLeft: -8,
      },
    },
    columnCell: {
      fontSize: '0.8rem',
      color: theme.palette.text.primary,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap' as const,
    },
    linkCell: {
      fontSize: '0.8rem',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap' as const,
      '& a': {
        color: theme.palette.primary.main,
        textDecoration: 'none',
        '&:hover': {
          textDecoration: 'underline',
        },
      },
    },
    cellWithIcon: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      overflow: 'hidden',
      '& svg': {
        fontSize: '1rem',
        color: theme.palette.text.secondary,
        flexShrink: 0,
      },
    },
    emptyValue: {
      color: theme.palette.text.disabled,
    },
    hiddenOnMobile: {
      [theme.breakpoints.down('xs')]: {
        display: 'none',
      },
    },

    entityName: {
      fontSize: '0.9rem',
      fontWeight: 600,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap' as const,
      '& a': {
        color: theme.palette.primary.main,
        textDecoration: 'none',
        '&:hover': {
          textDecoration: 'underline',
        },
      },
    },
    entityNameDisabled: {
      fontSize: '0.9rem',
      fontWeight: 600,
      color: theme.palette.text.disabled,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap' as const,
    },
    deletionRow: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      minWidth: 0,
    },
    description: {
      fontSize: '0.8rem',
      color: theme.palette.text.secondary,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap' as const,
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
    metadataChip: {
      fontSize: '0.7rem',
      height: 20,
      borderRadius: 4,
      fontWeight: 500,
    },
    agentStatus: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      fontSize: '0.75rem',
      whiteSpace: 'nowrap' as const,
    },
    agentDot: {
      width: 8,
      height: 8,
      borderRadius: '50%',
    },
    agentConnected: {
      backgroundColor: theme.palette.success.main,
    },
    agentDisconnected: {
      backgroundColor: theme.palette.error.main,
    },
  };
});
