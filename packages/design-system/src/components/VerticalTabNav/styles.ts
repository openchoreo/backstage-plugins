import { makeStyles, Theme, alpha } from '@material-ui/core/styles';
import { lightTokens, darkTokens } from '../../theme/tokens';

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
        theme.palette.type === 'dark'
          ? darkTokens.surface.hover
          : lightTokens.surface.hover,
    },
  },
  tabItemActive: {
    borderLeftColor: theme.palette.primary.main,
    // Original: `#f5f7ff` (indigo[50]) in light, `rgba(108,127,216,0.12)` in dark.
    backgroundColor:
      theme.palette.type === 'dark'
        ? alpha(theme.palette.primary.main, 0.12)
        : lightTokens.indigo[50],
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
      theme.palette.type === 'dark'
        ? darkTokens.scrim.med
        : lightTokens.border.subtle,
    padding: '2px 8px',
    borderRadius: 10,
    minWidth: 20,
    textAlign: 'center',
  },
  contentPanel: {
    flex: 1,
    overflowY: 'auto',
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
  },
  tabItemGroup: {
    fontWeight: 600,
    '&:hover': {
      // Original: `#fafbfc` (secondary.light).
      backgroundColor:
        theme.palette.type === 'dark'
          ? darkTokens.scrim.subtle
          : lightTokens.secondary.light,
    },
  },
  tabItemNested: {
    fontSize: 13,
    '& $tabLabel': {
      fontSize: 13,
    },
  },
  expandIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.palette.text.secondary,
    transition: 'transform 0.2s ease-in-out',
    '& svg': {
      fontSize: 18,
    },
  },
  expandIconExpanded: {
    transform: 'rotate(180deg)',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(1.5, 2, 1.5),
    borderTop: `1px solid ${theme.palette.divider}`,
    marginTop: theme.spacing(0.5),
    '&:first-child': {
      borderTop: 'none',
      marginTop: 0,
    },
  },
  sectionHeaderLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: theme.palette.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  sectionHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
}));
