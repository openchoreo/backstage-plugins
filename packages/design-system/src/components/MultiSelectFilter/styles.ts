import { makeStyles, Theme } from '@material-ui/core/styles';
import { darkTokens, lightTokens } from '../../theme/tokens';

export const useStyles = makeStyles((theme: Theme) => {
  const tokens = theme.palette.type === 'dark' ? darkTokens : lightTokens;
  return {
    button: {
      textTransform: 'none',
      borderRadius: theme.spacing(1),
      borderColor: tokens.border.default,
    },
    // Signals an active filter (a non-default selection).
    buttonActive: {
      borderColor: theme.palette.primary.main,
      color: theme.palette.primary.main,
      backgroundColor: tokens.indigo[50],
      '&:hover': {
        backgroundColor: tokens.indigo[100],
      },
    },
    // Caps the trigger label width so long values don't blow out the layout;
    // the full selection is shown on hover.
    buttonLabel: {
      display: 'inline-block',
      maxWidth: 180,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    menuPaper: {
      minWidth: 240,
      maxHeight: 360,
      padding: theme.spacing(0.5, 0),
      // Use the raised surface + a soft shadow so the menu reads as a distinct
      // floating layer (in dark mode the default paper blends with the page).
      backgroundColor: tokens.surface.raised,
      boxShadow: tokens.shadow.lg,
    },
    menuActions: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: theme.spacing(1.5),
      padding: theme.spacing(0.5, 1.5, 0, 1.5),
    },
    menuActionButton: {
      textTransform: 'none',
      minWidth: 'auto',
      padding: 0,
      fontSize: '0.8125rem',
    },
    groupLabel: {
      display: 'block',
      color: theme.palette.text.secondary,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      fontSize: '0.6875rem',
      fontWeight: 600,
      // Override MUI ListSubheader's default 48px line-height.
      lineHeight: 1.4,
      padding: theme.spacing(1, 2, 0.75, 2),
    },
    menuItem: {
      minHeight: 'auto',
      paddingTop: theme.spacing(0.25),
      paddingBottom: theme.spacing(0.25),
    },
    checkbox: {
      padding: theme.spacing(0.5),
      marginRight: theme.spacing(0.75),
    },
  };
});
