import { useTheme } from '@material-ui/core/styles';
import { darkTokens, lightTokens, ThemeTokens } from './tokens';

/**
 * Returns the active theme's extended token set.
 *
 * MUI's `theme.palette` object only carries MUI-shaped slots; this hook surfaces
 * the extra tokens (scrim tiers, entity-kind palette, gradients, editor/graph
 * colors) that components need to stay fully theme-aware.
 */
export function useChoreoTokens(): ThemeTokens {
  const theme = useTheme();
  return theme.palette.type === 'dark' ? darkTokens : lightTokens;
}
