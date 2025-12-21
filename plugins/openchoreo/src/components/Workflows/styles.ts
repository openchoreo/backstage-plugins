import { makeStyles } from '@material-ui/core/styles';

export const useWorkflowStyles = makeStyles(theme => ({
  statusChip: {
    fontWeight: 500,
    fontSize: '0.8125rem',
    height: '24px',
  },
  successChip: {
    backgroundColor: theme.palette.success.light,
    color: theme.palette.success.dark,
    '& .MuiChip-icon': {
      color: `${theme.palette.success.dark} !important`,
    },
  },
  errorChip: {
    backgroundColor: theme.palette.error.light,
    color: theme.palette.error.dark,
    '& .MuiChip-icon': {
      color: `${theme.palette.error.dark} !important`,
    },
  },
  runningChip: {
    backgroundColor: theme.palette.secondary.light,
    color: theme.palette.info.dark,
    '& .MuiChip-icon': {
      color: `${theme.palette.info.dark} !important`,
    },
  },
  pendingChip: {
    backgroundColor: theme.palette.warning.light,
    color: theme.palette.warning.dark,
    '& .MuiChip-icon': {
      color: `${theme.palette.warning.dark} !important`,
    },
  },
}));
