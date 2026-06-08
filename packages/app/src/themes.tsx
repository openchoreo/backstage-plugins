import { useEffect, type ReactNode } from 'react';
import type { AppTheme } from '@backstage/core-plugin-api';
import { UnifiedThemeProvider } from '@backstage/theme';
import {
  darkTokens,
  lightTokens,
  OpenChoreoIcon,
  openChoreoDarkTheme,
  openChoreoTheme,
  type ThemeTokens,
} from '@openchoreo/backstage-design-system';

// Backstage v1.51's `UnifiedThemeProvider` already sets `data-theme-mode` on
// `<body>` so `@backstage/ui` (BUI) flips to its dark variant — but BUI's
// built-in dark palette resolves `--bui-bg-app` to `#333`, not our
// `surface.default`. Body bg ends up as `var(--bui-bg-app)` (from
// `@backstage/ui/css/styles.css`), so without an override the dark page
// paints `#333` even though every other surface uses our palette.
//
// This bridge writes our palette into the load-bearing BUI surface/fg
// variables as inline styles on `<body>`. It must be `<body>` (not `:root`)
// because BUI's `[data-theme-mode="dark"]` rule also matches body and would
// otherwise win on DOM proximity.
//
// Light mode is a no-op — BUI's `:root` light defaults already match the
// previous pre-migration look (page surround = `#f8f8f8`, cards = white).
// Forcing our `surface.default` (`#ffffff`) here would flatten the page
// against the cards.
function BuiThemeBridge({
  mode,
  children,
}: {
  mode: 'light' | 'dark';
  children?: ReactNode;
}) {
  useEffect(() => {
    const body = document.body;
    const t: ThemeTokens = mode === 'dark' ? darkTokens : lightTokens;
    // Align BUI primary buttons (e.g. Scaffolder Review) with our MUI
    // `containedPrimary` fill (used by Scaffolder Create). Applied in both
    // modes so the two button systems read as one.
    const solidOverrides: Record<string, string> = {
      '--bui-bg-solid': t.primary.main,
      '--bui-bg-solid-hover': t.primary.dark,
      '--bui-bg-solid-pressed': t.primary.dark,
      '--bui-bg-solid-disabled': t.primary.light,
    };
    // Surface/foreground overrides are dark-mode-only: BUI's light defaults
    // (`#f8f8f8` page surround etc.) already match the pre-migration look,
    // and forcing `surface.default` (`#ffffff`) in light flattens the page.
    const surfaceOverrides: Record<string, string> =
      mode === 'dark'
        ? {
            '--bui-bg-app': t.surface.default,
            '--bui-bg-surface-1': t.surface.paper,
            '--bui-bg-surface-2': t.surface.raised,
            '--bui-fg-primary': t.text.primary,
            '--bui-fg-secondary': t.text.secondary,
          }
        : {};
    const overrides = { ...solidOverrides, ...surfaceOverrides };
    const previous: Record<string, string> = {};
    for (const [name, value] of Object.entries(overrides)) {
      previous[name] = body.style.getPropertyValue(name);
      body.style.setProperty(name, value);
    }
    return () => {
      for (const [name, value] of Object.entries(previous)) {
        if (value) body.style.setProperty(name, value);
        else body.style.removeProperty(name);
      }
    };
  }, [mode]);
  return <>{children}</>;
}

/**
 * App themes registered with `createApp`.
 *
 * We intentionally do NOT define a custom "auto" theme here — Backstage's
 * user-settings panel already renders a built-in Auto button that clears
 * the stored theme id and makes the app respect the OS `prefers-color-scheme`
 * preference. It picks the first dark-variant theme when the OS is dark and
 * the first light-variant theme when the OS is light, which is exactly what
 * we want. See `Backstage UserSettingsThemeToggle`.
 */
export const appThemes: AppTheme[] = [
  {
    id: 'openchoreo-dark',
    title: 'Dark',
    variant: 'dark',
    icon: <OpenChoreoIcon />,
    Provider: ({ children }) => (
      <UnifiedThemeProvider theme={openChoreoDarkTheme}>
        <BuiThemeBridge mode="dark">{children}</BuiThemeBridge>
      </UnifiedThemeProvider>
    ),
  },
  {
    id: 'openchoreo-light',
    title: 'Light',
    variant: 'light',
    icon: <OpenChoreoIcon />,
    Provider: ({ children }) => (
      <UnifiedThemeProvider theme={openChoreoTheme}>
        <BuiThemeBridge mode="light">{children}</BuiThemeBridge>
      </UnifiedThemeProvider>
    ),
  },
];
