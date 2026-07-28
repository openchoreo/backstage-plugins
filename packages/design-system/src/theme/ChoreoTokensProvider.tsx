import { ReactNode, createContext } from 'react';
import { ThemeTokens } from './tokens';

/**
 * Carries the ACTIVE (possibly brand-overridden) token set down to components
 * that read tokens via `useChoreoTokens`. Without a provider the hook falls
 * back to the stock `lightTokens`/`darkTokens` singletons, so wrapping is only
 * required when tokens diverge from the defaults (e.g. `app.branding.*`).
 */
export const ChoreoTokensContext = createContext<ThemeTokens | undefined>(
  undefined,
);

export function ChoreoTokensProvider({
  tokens,
  children,
}: {
  tokens: ThemeTokens;
  children?: ReactNode;
}) {
  return (
    <ChoreoTokensContext.Provider value={tokens}>
      {children}
    </ChoreoTokensContext.Provider>
  );
}
