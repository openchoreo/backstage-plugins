import { makeStyles, Theme } from '@material-ui/core/styles';
import { darkTokens, lightTokens } from '../../theme/tokens';

export const useStyles = makeStyles((theme: Theme) => {
  const tokens = theme.palette.type === 'dark' ? darkTokens : lightTokens;
  return {
    buttonGroup: {
      borderRadius: 8,
      '& .MuiButton-root': {
        borderRadius: 'inherit',
      },
      '& .MuiButton-root:not(:last-child)': {
        borderTopRightRadius: 0,
        borderBottomRightRadius: 0,
      },
      '& .MuiButton-root:not(:first-child)': {
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0,
      },
    },
    dropdownButton: {
      padding: '6px 4px',
      minWidth: 'unset',
      borderLeft: `1px solid ${theme.palette.primary.dark}`,
    },
    // Render above surrounding content (e.g. table rows/headers) — the menu is
    // portaled so it also escapes any ancestor `overflow: hidden`.
    popper: {
      zIndex: theme.zIndex.modal,
    },
    // Raised surface + shadow so the menu reads as a distinct floating layer
    // (in dark mode the default paper blends with the page background).
    menuPaper: {
      backgroundColor: tokens.surface.raised,
      boxShadow: tokens.shadow.lg,
    },
  };
});
