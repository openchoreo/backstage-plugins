import { alpha, darken, lighten } from '@material-ui/core/styles';
import { ColorScale, ThemeTokens } from './tokens';

/**
 * Brand overrides that can be applied on top of a base token set.
 *
 * Only the brand accent is overridable for now; the rest of the palette
 * (neutral greys, status colors, typography) is deliberately fixed so a
 * one-line rebrand cannot degrade readability. `light`/`dark` are derived
 * from `main` when omitted.
 */
export interface BrandPaletteOverrides {
  primary?: {
    main: string;
    light?: string;
    dark?: string;
  };
}

/**
 * Applies {@link BrandPaletteOverrides} to a base {@link ThemeTokens} set,
 * recomputing every token slot that carries the brand accent today.
 *
 * Identity guarantee: when `brand` provides no `primary.main`, the SAME
 * object reference as `base` is returned — callers can rely on `===` to keep
 * using prebuilt theme singletons, making the no-branding path byte-identical
 * to the stock look.
 *
 * Recomputed from `primary.main`: the primary scale, `text.link`/`linkHover`,
 * `navigation.indicator`/`selectedColor`, `status.info`/`running`,
 * `banner.info`/`link`, `graph.edge` + minimap viewport tints, and — in light
 * mode only — the `gradient.*` and `bursts.gradient` brand gradients.
 *
 * NOT recomputed (kept from `base`): dark-mode gradients (built on the navy
 * `indigo` ramp; deriving a dark ramp from an arbitrary hue is guesswork),
 * the `indigo` ramp itself, `entityKind` accents, `statusBackground.info`
 * tint, and `secondary` (it is the neutral text ramp, not a brand accent).
 */
export function resolveBrandTokens(
  base: ThemeTokens,
  brand?: BrandPaletteOverrides,
): ThemeTokens {
  const main = brand?.primary?.main;
  if (!main) {
    return base;
  }

  const isDark = base.mode === 'dark';
  // Light mode's `primary.light` is a near-white tint (chip/selection
  // backgrounds); dark mode's is only slightly lighter than `main` (link
  // hover, selected labels) — hence the mode-dependent coefficient.
  const primary: ColorScale = {
    main,
    light: brand.primary?.light ?? lighten(main, isDark ? 0.25 : 0.9),
    dark: brand.primary?.dark ?? darken(main, 0.15),
  };

  return {
    ...base,
    primary,
    text: {
      ...base.text,
      link: main,
      linkHover: isDark ? primary.light : primary.dark,
    },
    status: {
      ...base.status,
      info: main,
      running: main,
    },
    navigation: {
      ...base.navigation,
      indicator: main,
      selectedColor: isDark ? primary.light : main,
    },
    banner: {
      ...base.banner,
      info: main,
      link: isDark ? primary.light : main,
    },
    graph: {
      ...base.graph,
      edge: main,
      minimapViewportTint: alpha(main, 0.1),
      minimapViewportTintActive: alpha(main, isDark ? 0.25 : 0.22),
      minimapViewportBorder: alpha(main, isDark ? 0.5 : 0.45),
    },
    ...(isDark
      ? {}
      : {
          gradient: {
            header: `linear-gradient(90deg, ${main} 0%, ${lighten(
              main,
              0.25,
            )} 100%)`,
            cardHeader: `linear-gradient(135deg, ${main} 0%, ${lighten(
              main,
              0.25,
            )} 100%)`,
            burst: `linear-gradient(135deg, ${main} 0%, ${lighten(
              main,
              0.5,
            )} 100%)`,
          },
          bursts: {
            ...base.bursts,
            gradient: `linear-gradient(135deg, ${main} 0%, ${lighten(
              main,
              0.5,
            )} 100%)`,
          },
        }),
  };
}
