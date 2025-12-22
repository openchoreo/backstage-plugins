import { makeStyles } from '@material-ui/core/styles';

export const useStyles = makeStyles(theme => ({
  content: {
    padding: 0,
  },
  tabsWrapper: {
    '& [class*="BackstageHeaderTabs-tabRoot"]': {
      fontSize: '14px !important',
      fontWeight: '700 !important',
      minWidth: 120,
      '&:hover': {
        textDecoration: 'underline',
      },
    },
    '& .MuiTabs-indicator': {
      height: '3px',
    },
  },
  tabPanel: {
    padding: theme.spacing(3),
    '& [class*="MuiTableCell-head"]': {
      fontSize: '14px !important',
    },
  },
}));
