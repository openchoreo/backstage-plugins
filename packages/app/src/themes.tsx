import type { AppTheme } from '@backstage/core-plugin-api';
import { UnifiedThemeProvider } from '@backstage/theme';
import {
  OpenChoreoIcon,
  openChoreoDarkTheme,
  openChoreoTheme,
} from '@openchoreo/backstage-design-system';

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
      <UnifiedThemeProvider theme={openChoreoDarkTheme} children={children} />
    ),
  },
  {
    id: 'openchoreo-light',
    title: 'Light',
    variant: 'light',
    icon: <OpenChoreoIcon />,
    Provider: ({ children }) => (
      <UnifiedThemeProvider theme={openChoreoTheme} children={children} />
    ),
  },
];
