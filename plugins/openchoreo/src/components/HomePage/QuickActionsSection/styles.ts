import { makeStyles } from '@material-ui/core/styles';

export const useStyles = makeStyles(theme => ({
  overviewSection: {
    marginBottom: theme.spacing(4),
  },
  quickActionsContainer: {
    marginTop: theme.spacing(3),
  },
  quickActionCard: {
    height: '100%',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.spacing(1),
    transition: 'all 0.2s ease-in-out',
    '&:hover': {
      borderColor: theme.palette.primary.main,
      boxShadow: theme.shadows[4],
      transform: 'translateY(-2px)',
    },
  },
  quickActionCardAction: {
    height: '100%',
    display: 'flex',
    alignItems: 'flex-start',
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'none',
    },
  },
  quickActionCardContent: {
    width: '100%',
    padding: theme.spacing(3),
  },
  // Two rows of tiles fit a default-height (4-row) home widget.
  quickActionCardContentCompact: {
    padding: theme.spacing(1.5, 2),
    '&:last-child': {
      paddingBottom: theme.spacing(1.5),
    },
  },
  quickActionHeaderCompact: {
    marginBottom: theme.spacing(0.5),
  },
  quickActionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(1),
  },
  quickActionTitle: {
    fontWeight: 600,
  },
  quickActionIcon: {
    color: theme.palette.text.secondary,
    opacity: 0.6,
  },
}));
