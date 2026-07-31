import { useMemo } from 'react';
import { ConfigApi, configApiRef, useApi } from '@backstage/core-plugin-api';
import { BrandPaletteOverrides } from '@openchoreo/backstage-design-system';

/** Product name used when `app.branding.name` is not configured. */
export const DEFAULT_BRAND_NAME = 'OpenChoreo';

/**
 * The portal's `app.branding.*` configuration (see `config.d.ts`). Every
 * field is optional; an empty object means the stock OpenChoreo look.
 *
 * @public
 */
export interface BrandingConfig {
  name?: string;
  iconLogo?: string;
  fullLogo?: string;
  theme?: {
    light?: { primaryColor?: string };
    dark?: { primaryColor?: string };
  };
}

/**
 * Reads one branding string, treating malformed values as unset. ConfigReader
 * THROWS (not `undefined`) for present-but-invalid values — notably empty
 * strings, which pass schema validation — and `readBrandingConfig` runs
 * during render, so an uncaught throw would white-screen the app.
 */
function readOptionalString(
  config: ConfigApi,
  key: string,
): string | undefined {
  try {
    return config.getOptionalString(key);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`Ignoring invalid branding config: ${error}`);
    return undefined;
  }
}

/** Reads `app.branding.*` from config. Exported for tests and non-hook use. */
export function readBrandingConfig(config: ConfigApi): BrandingConfig {
  const primary = (mode: 'light' | 'dark') =>
    readOptionalString(config, `app.branding.theme.${mode}.primaryColor`);
  const light = primary('light');
  const dark = primary('dark');
  return {
    name: readOptionalString(config, 'app.branding.name'),
    iconLogo: readOptionalString(config, 'app.branding.iconLogo'),
    fullLogo: readOptionalString(config, 'app.branding.fullLogo'),
    ...(light || dark
      ? {
          theme: {
            ...(light ? { light: { primaryColor: light } } : {}),
            ...(dark ? { dark: { primaryColor: dark } } : {}),
          },
        }
      : {}),
  };
}

/**
 * Returns the active {@link BrandingConfig}. The result is memoized on the
 * config API instance so consumers can safely use it in hook dependencies —
 * theme rebuilds key off its identity.
 *
 * @public
 */
export function useBranding(): BrandingConfig {
  const configApi = useApi(configApiRef);
  return useMemo(() => readBrandingConfig(configApi), [configApi]);
}

/**
 * The configured product name, falling back to "OpenChoreo".
 *
 * @public
 */
export function brandName(branding: BrandingConfig): string {
  return branding.name ?? DEFAULT_BRAND_NAME;
}

/**
 * Converts branding config into design-system brand overrides for one theme
 * mode. Returns `undefined` when no brand color is configured for that mode —
 * the signal for callers to keep the prebuilt stock theme.
 */
export function toBrandOverrides(
  branding: BrandingConfig,
  mode: 'light' | 'dark',
): BrandPaletteOverrides | undefined {
  const main = branding.theme?.[mode]?.primaryColor;
  return main ? { primary: { main } } : undefined;
}
