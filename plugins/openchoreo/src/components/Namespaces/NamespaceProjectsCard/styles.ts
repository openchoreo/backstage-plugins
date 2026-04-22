import { makeStyles } from '@material-ui/core/styles';
import { lightTokens, darkTokens } from '@openchoreo/backstage-design-system';

export const useNamespaceProjectsCardStyles = makeStyles(theme => ({
  cardWrapper: {
    height: '100%',
    '& > div': {
      height: '100%',
    },
    '& [class*="MuiPaper-root"][class*="MuiPaper-elevation"]': {
      borderRadius: '12px !important',
      border: `1px solid ${
        theme.palette.type === 'dark'
          ? darkTokens.border.subtle
          : lightTokens.grey[100]
      } !important`,
      boxShadow: `${
        theme.palette.type === 'dark'
          ? darkTokens.shadow.card
          : lightTokens.shadow.card
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
  createProjectButton: {
    textTransform: 'none',
    marginRight: theme.spacing(2),
    borderRadius: theme.spacing(1),
  },
}));
