import { makeStyles } from '@material-ui/core/styles';
import { lightTokens, darkTokens } from '@openchoreo/backstage-design-system';

export const useNotificationChannelOverviewStyles = makeStyles(theme => ({
  card: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '12px !important',
    border: `1px solid ${
      theme.palette.type === 'dark'
        ? darkTokens.border.subtle
        : lightTokens.border.subtle
    } !important`,
    boxShadow: `${
      theme.palette.type === 'dark'
        ? darkTokens.shadow.card
        : lightTokens.shadow.card
    } !important`,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
  },
  typeBadge: {
    fontSize: theme.typography.caption.fontSize,
    fontWeight: 600,
    textTransform: 'uppercase',
    padding: theme.spacing(0.25, 1),
    borderRadius: theme.spacing(0.5),
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
  },
  defaultBadge: {
    fontSize: theme.typography.caption.fontSize,
    fontWeight: 600,
    padding: theme.spacing(0.25, 1),
    borderRadius: theme.spacing(0.5),
    backgroundColor: theme.palette.grey[200],
    color: theme.palette.grey[700],
    marginLeft: theme.spacing(1),
  },
  infoRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1.5),
  },
  infoLabel: {
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.text.secondary,
    fontWeight: 500,
    minWidth: '140px',
  },
  infoValue: {
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.text.primary,
  },
  headerList: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
  },
  headerItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(0.5),
  },
  headerSourceBadge: {
    fontSize: theme.typography.caption.fontSize,
    padding: theme.spacing(0.125, 0.75),
    borderRadius: theme.spacing(0.5),
    backgroundColor: theme.palette.background.default,
    color: theme.palette.text.secondary,
  },
}));
