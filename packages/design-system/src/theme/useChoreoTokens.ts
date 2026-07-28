import { useContext } from 'react';
import { useTheme } from '@material-ui/core/styles';
import { ChoreoTokensContext } from './ChoreoTokensProvider';
import { darkTokens, lightTokens, ThemeTokens } from './tokens';

/**
 * Returns the active theme's extended token set.
 *
 * MUI's `theme.palette` object only carries MUI-shaped slots; this hook surfaces
 * the extra tokens (scrim tiers, entity-kind palette, gradients, editor/graph
 * colors) that components need to stay fully theme-aware.
 *
 * Prefers the tokens supplied by a {@link ChoreoTokensProvider} (which carry
 * any `app.branding.*` overrides); outside a provider it falls back to the
 * stock singletons picked by the MUI palette type.
 */
export function useChoreoTokens(): ThemeTokens {
  const contextTokens = useContext(ChoreoTokensContext);
  const theme = useTheme();
  if (contextTokens) {
    return contextTokens;
  }
  return theme.palette.type === 'dark' ? darkTokens : lightTokens;
}
