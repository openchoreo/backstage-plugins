import { makeStyles } from '@material-ui/core/styles';
import { lightTokens, darkTokens } from '@openchoreo/backstage-design-system';

export const useProjectContentsCardStyles = makeStyles(theme => {
  const tokens = theme.palette.type === 'dark' ? darkTokens : lightTokens;
  return {
    // --- Card shell ---------------------------------------------------------
    cardWrapper: {
      display: 'flex',
      flexDirection: 'column',
      minHeight: 300,
      backgroundColor: theme.palette.background.paper,
      border: `1px solid ${tokens.border.subtle}`,
      borderRadius: theme.spacing(1.5),
      boxShadow: tokens.shadow.card,
      overflow: 'hidden',
      // Flatten the material-table Paper so the custom header and the table
      // read as a single card.
      '& [class*="MuiPaper-root"][class*="MuiPaper-elevation"]': {
        boxShadow: 'none !important',
        border: 'none !important',
        borderRadius: 0,
        backgroundColor: 'transparent !important',
      },
      '& tbody tr': {
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
        '&:hover': {
          backgroundColor: theme.palette.action.hover,
        },
      },
      // Tighten row height — material-table's dense padding is still roomy.
      '& tbody td': {
        paddingTop: theme.spacing(0.75),
        paddingBottom: theme.spacing(0.75),
      },
    },

    // --- Header (title + count, search, create) -----------------------------
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing(2),
      flexWrap: 'wrap',
      padding: theme.spacing(2, 3),
    },
    titleGroup: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
    },
    countBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: theme.spacing(2.5),
      height: theme.spacing(2.5),
      padding: theme.spacing(0, 0.75),
      borderRadius: theme.spacing(1.25),
      backgroundColor: theme.palette.action.hover,
      color: theme.palette.text.secondary,
      fontSize: '0.75rem',
      fontWeight: 600,
    },
    headerActions: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1.5),
    },
    searchField: {
      // Fixed width (not min-width) so the field doesn't jump when the clear
      // button's adornment appears/disappears as the user types.
      width: 220,
      flexShrink: 0,
    },
    // Lets the table scroll horizontally on narrow viewports instead of
    // crushing the fixed columns until cell content overlaps.
    tableScroll: {
      width: '100%',
      overflowX: 'auto',
    },
    skeletonBody: {
      flexGrow: 1,
      padding: theme.spacing(1, 3, 3),
    },

    // --- Deployment status chips -------------------------------------------
    deploymentStatus: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(0.5),
      alignItems: 'center',
    },
    chipContainer: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
    },
    environmentChip: {
      height: 22,
      fontWeight: 500,
      textTransform: 'capitalize',
    },
    statusIconReady: {
      color: theme.palette.success.main,
    },
    statusIconWarning: {
      color: theme.palette.warning.main,
    },
    statusIconError: {
      color: theme.palette.error.main,
    },
    statusIconDefault: {
      color: theme.palette.text.secondary,
    },
    moreChip: {
      height: 22,
      fontWeight: 500,
      cursor: 'default',
      color: theme.palette.text.secondary,
      borderColor: theme.palette.divider,
    },
    notDeployed: {
      color: theme.palette.text.secondary,
    },
    // Pill-shaped placeholder matching an environment chip's footprint.
    skeletonChip: {
      borderRadius: 11,
    },

    // --- Empty state (project has no contents) ------------------------------
    emptyState: {
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing(2.5),
      padding: theme.spacing(4, 3),
      textAlign: 'center',
    },
    emptyText: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: theme.spacing(0.5),
    },
    emptyTitle: {
      color: theme.palette.text.secondary,
    },
    emptySubtitle: {
      color: tokens.text.verySubtle,
    },

    // --- Cursor pager -------------------------------------------------------
    pager: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: theme.spacing(1),
      padding: theme.spacing(1, 2),
    },
    pagerLabel: {
      color: theme.palette.text.secondary,
      fontSize: '0.8125rem',
    },
  };
});
