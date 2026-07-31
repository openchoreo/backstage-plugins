import { render, screen } from '@testing-library/react';
import { useTheme } from '@material-ui/core/styles';
import { configApiRef } from '@backstage/core-plugin-api';
import { TestApiProvider, mockApis } from '@backstage/test-utils';
import { useChoreoTokens } from '@openchoreo/backstage-design-system';
import { appThemes } from './themes';

// Probes the two token paths a brand color must reach: the MUI palette
// (via UnifiedThemeProvider) and the extended tokens (via useChoreoTokens).
function Probe() {
  const theme = useTheme();
  const tokens = useChoreoTokens();
  return (
    <>
      <span data-testid="palette-primary">{theme.palette.primary.main}</span>
      <span data-testid="graph-edge">{tokens.graph.edge}</span>
    </>
  );
}

function renderThemeProvider(
  themeId: 'openchoreo-light' | 'openchoreo-dark',
  config: ReturnType<typeof mockApis.config>,
) {
  const entry = appThemes.find(t => t.id === themeId)!;
  const Provider = entry.Provider;
  return render(
    <TestApiProvider apis={[[configApiRef, config]]}>
      <Provider>
        <Probe />
      </Provider>
    </TestApiProvider>,
  );
}

describe('appThemes', () => {
  it('applies the configured brand primary to palette and tokens', () => {
    // This also proves the config API is readable inside a theme Provider —
    // the load-bearing assumption of config-driven branding.
    renderThemeProvider(
      'openchoreo-light',
      mockApis.config({
        data: {
          app: {
            branding: { theme: { light: { primaryColor: '#b91c1c' } } },
          },
        },
      }),
    );
    expect(screen.getByTestId('palette-primary').textContent).toBe('#b91c1c');
    expect(screen.getByTestId('graph-edge').textContent).toBe('#b91c1c');
  });

  it('applies the dark brand primary when the dark theme renders', () => {
    // Distinct per-mode colors prove mode selection, not just plumbing.
    renderThemeProvider(
      'openchoreo-dark',
      mockApis.config({
        data: {
          app: {
            branding: {
              theme: {
                light: { primaryColor: '#b91c1c' },
                dark: { primaryColor: '#2dd4bf' },
              },
            },
          },
        },
      }),
    );
    expect(screen.getByTestId('palette-primary').textContent).toBe('#2dd4bf');
    expect(screen.getByTestId('graph-edge').textContent).toBe('#2dd4bf');
  });

  it('serves the stock theme when no branding is configured', () => {
    renderThemeProvider('openchoreo-light', mockApis.config({ data: {} }));
    expect(screen.getByTestId('palette-primary').textContent).toBe('#5568c4');
    expect(screen.getByTestId('graph-edge').textContent).toBe('#5568c4');
  });
});
