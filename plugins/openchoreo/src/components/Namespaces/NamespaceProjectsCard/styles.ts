import { makeStyles } from '@material-ui/core/styles';

export const useNamespaceProjectsCardStyles = makeStyles(theme => ({
  cardWrapper: {
    height: '100%',
    '& > div': {
      height: '100%',
    },
    '& [class*="MuiPaper-root"][class*="MuiPaper-elevation"]': {
      borderRadius: '12px !important',
      border: '1px solid rgb(243, 244, 246) !important',
      boxShadow:
        'rgba(0, 0, 0, 0.05) 0px 1px 3px 0px, rgba(0, 0, 0, 0.03) 0px 1px 2px 0px !important',
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
  },
  createProjectButton: {
    textTransform: 'none',
    marginRight: theme.spacing(2),
    borderRadius: theme.spacing(1),
  },
}));
