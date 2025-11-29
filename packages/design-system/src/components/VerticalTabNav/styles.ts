import { makeStyles, Theme } from '@material-ui/core/styles';

export const useStyles = makeStyles((theme: Theme) => ({
  container: {
    display: 'flex',
    height: '100%',
    overflow: 'hidden',
  },
  tabList: {
    display: 'flex',
    flexDirection: 'column',
    width: 200,
    minWidth: 200,
    borderRight: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    overflowY: 'auto',
    flexShrink: 0,
  },
  tabItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5, 2),
    cursor: 'pointer',
    borderLeft: '3px solid transparent',
    transition: 'all 0.2s ease-in-out',
    '&:hover': {
      backgroundColor:
        theme.palette.type === 'dark' ? 'rgba(255, 255, 255, 0.08)' : '#f9fafb',
    },
  },
  tabItemActive: {
    borderLeftColor: theme.palette.primary.main,
    backgroundColor:
      theme.palette.type === 'dark' ? 'rgba(108, 127, 216, 0.12)' : '#f5f7ff',
    '& $tabLabel': {
      color: theme.palette.primary.main,
      fontWeight: 600,
    },
  },
  tabItemDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
    '&:hover': {
      backgroundColor: 'transparent',
    },
  },
  tabIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.palette.text.secondary,
    '& svg': {
      fontSize: 20,
    },
  },
  tabContent: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: 500,
    color: theme.palette.text.primary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    flex: 1,
  },
  tabIndicators: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginLeft: 'auto',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  statusSuccess: {
    backgroundColor: theme.palette.success.main,
  },
  statusWarning: {
    backgroundColor: theme.palette.warning.main,
  },
  statusError: {
    backgroundColor: theme.palette.error.main,
  },
  statusInfo: {
    backgroundColor: theme.palette.info.main,
  },
  statusDefault: {
    backgroundColor: theme.palette.grey[400],
  },
  countBadge: {
    fontSize: 12,
    fontWeight: 500,
    color: theme.palette.text.secondary,
    backgroundColor:
      theme.palette.type === 'dark' ? 'rgba(255, 255, 255, 0.12)' : '#f3f4f6',
    padding: '2px 8px',
    borderRadius: 10,
    minWidth: 20,
    textAlign: 'center',
  },
  contentPanel: {
    flex: 1,
    overflowY: 'auto',
    padding: theme.spacing(2),
  },
}));
