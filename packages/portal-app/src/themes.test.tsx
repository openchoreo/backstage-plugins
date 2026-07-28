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

function renderLightProvider(config: ReturnType<typeof mockApis.config>) {
  const light = appThemes.find(t => t.id === 'openchoreo-light')!;
  const Provider = light.Provider;
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
    renderLightProvider(
      mockApis.config({
        data: {
          app: {
            branding: { theme: { light: { primaryColor: '#ff0000' } } },
          },
        },
      }),
    );
    expect(screen.getByTestId('palette-primary').textContent).toBe('#ff0000');
    expect(screen.getByTestId('graph-edge').textContent).toBe('#ff0000');
  });

  it('serves the stock theme when no branding is configured', () => {
    renderLightProvider(mockApis.config({ data: {} }));
    expect(screen.getByTestId('palette-primary').textContent).toBe('#5568c4');
    expect(screen.getByTestId('graph-edge').textContent).toBe('#5568c4');
  });
});
