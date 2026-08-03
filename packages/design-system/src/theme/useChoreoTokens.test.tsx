import { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@material-ui/core/styles';
import { ChoreoTokensProvider } from './ChoreoTokensProvider';
import { darkTokens, lightTokens } from './tokens';
import { useChoreoTokens } from './useChoreoTokens';

function muiWrapper(type: 'light' | 'dark') {
  const theme = createTheme({ palette: { type } });
  return ({ children }: { children: ReactNode }) => (
    <ThemeProvider theme={theme}>{children}</ThemeProvider>
  );
}

describe('useChoreoTokens', () => {
  it('falls back to the singletons picked by palette type', () => {
    const light = renderHook(() => useChoreoTokens(), {
      wrapper: muiWrapper('light'),
    });
    expect(light.result.current).toBe(lightTokens);

    const dark = renderHook(() => useChoreoTokens(), {
      wrapper: muiWrapper('dark'),
    });
    expect(dark.result.current).toBe(darkTokens);
  });

  it('prefers tokens from ChoreoTokensProvider', () => {
    const branded = { ...lightTokens, deletionWarning: '#123456' };
    const Mui = muiWrapper('light');
    const { result } = renderHook(() => useChoreoTokens(), {
      wrapper: ({ children }) => (
        <Mui>
          <ChoreoTokensProvider tokens={branded}>
            {children}
          </ChoreoTokensProvider>
        </Mui>
      ),
    });
    expect(result.current).toBe(branded);
  });
});
