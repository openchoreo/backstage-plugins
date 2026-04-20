import { makeStyles } from '@material-ui/core/styles';
import { lightTokens, darkTokens } from '@openchoreo/backstage-design-system';

export const useProjectComponentsCardStyles = makeStyles(theme => ({
  cardWrapper: {
    overflowX: 'hidden' as const,
    '& [class*="MuiPaper-root"][class*="MuiPaper-elevation"]': {
      borderRadius: '12px !important',
      border: `1px solid ${
        theme.palette.type === 'dark' ? darkTokens.border.subtle : lightTokens.grey[100]
      } !important`,
      boxShadow: `${
        theme.palette.type === 'dark' ? darkTokens.shadow.card : lightTokens.shadow.card
      } !important`,
    },
    '& [class*="MuiTableFooter-root"]': {
      borderRadius: '0 0 12px 12px !important',
    },
    '& tfoot tr': {
      borderBottomLeftRadius: '12px !important',
      borderBottomRightRadius: '12px !important',
    },
    '& tfoot td': {
      borderBottom: 'none !important',
    },
    '& [class*="MuiTablePagination-toolbar"]': {
      borderBottomLeftRadius: '12px !important',
      borderBottomRightRadius: '12px !important',
    },
    '& tbody tr:last-child td:first-child': {
      borderBottomLeftRadius: '12px !important',
    },
    '& tbody tr:last-child td:last-child': {
      borderBottomRightRadius: '12px !important',
    },
    '& tbody tr': {
      cursor: 'pointer',
      transition: 'background-color 0.2s ease',
      '&:hover': {
        backgroundColor: theme.palette.action.hover,
      },
    },
  },
  deploymentStatus: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    alignItems: 'center',
  },
  chipContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  },
  environmentChip: {
    height: '24px',
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
  buildStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  },
  tooltipBuildName: {
    fontWeight: 600,
    color: theme.palette.common.white,
  },
  moreChip: {
    height: '24px',
    fontWeight: 500,
    cursor: 'default',
    color: theme.palette.text.secondary,
    borderColor: theme.palette.divider,
  },
  createComponentButton: {
    textTransform: 'none',
    marginRight: theme.spacing(2),
    borderRadius: theme.spacing(1),
  },
}));
