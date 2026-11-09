import {
  darken,
  getContrastRatio,
  lighten,
  type Theme,
} from '@material-ui/core/styles';

/**
 * Default tier names. A portal renames them with the maturity plugin's own
 * `techInsights.maturity.rank.<tier>.title` keys (see `useTierLabel`).
 */
export const TIER_LABEL: Record<number, string> = {
  0: 'Stone',
  1: 'Bronze',
  2: 'Silver',
  3: 'Gold',
};

/** Tiers a check can belong to; Stone is where an entity starts. */
export const CHECK_TIERS = [1, 2, 3];

/** The tier's key under `techInsights.maturity.rank`. */
export const TIER_CONFIG_KEY: Record<number, string> = {
  0: 'stone',
  1: 'bronze',
  2: 'silver',
  3: 'gold',
};

/*
 * Base hues per tier, one set per palette type. Not sourced from any host
 * design system: this package has no `@openchoreo/*` dependencies so any
 * Backstage portal can use it. The colours actually drawn are derived from
 * these against the theme's own surfaces (see `readableOn`).
 */
const LIGHT_TIER_HUE: Record<number, string> = {
  0: '#9ca3af',
  1: '#9a5b23',
  2: '#5b6472',
  3: '#a3720b',
};

const DARK_TIER_HUE: Record<number, string> = {
  0: '#6b7280',
  1: '#d8a367',
  2: '#cbd5e1',
  3: '#f3ba37',
};

/** WCAG AA for normal-size text. */
const MIN_CONTRAST = 4.5;

/**
 * `color`, darkened on a light background or lightened on a dark one until
 * it reaches AA contrast against `background`.
 */
export function readableOn(color: string, background: string): string {
  const onDark =
    getContrastRatio(background, '#fff') > getContrastRatio(background, '#000');
  let candidate = color;
  for (
    let step = 1;
    step <= 20 && getContrastRatio(candidate, background) < MIN_CONTRAST;
    step++
  ) {
    candidate = onDark
      ? lighten(color, step * 0.05)
      : darken(color, step * 0.05);
  }
  return candidate;
}

function tierHue(rank: number, theme: Theme): string | undefined {
  const hues = theme.palette.type === 'dark' ? DARK_TIER_HUE : LIGHT_TIER_HUE;
  return hues[rank];
}

/**
 * The tier's colour for text, outlines and marks drawn on the theme's paper
 * surface, at AA contrast in either palette type.
 */
export function getTierColor(rank: number, theme: Theme): string {
  const hue = tierHue(rank, theme);
  return hue
    ? readableOn(hue, theme.palette.background.paper)
    : theme.palette.text.secondary;
}

/**
 * A filled tier chip's background and text: the tier hue with whichever of
 * black or white reads better on it, the hue adjusted if neither reaches AA.
 */
export function getFilledTierColors(
  rank: number,
  theme: Theme,
): { background: string; text: string } {
  const hue = tierHue(rank, theme) ?? theme.palette.text.secondary;
  const { black, white } = theme.palette.common;
  const text =
    getContrastRatio(hue, white) >= getContrastRatio(hue, black)
      ? white
      : black;
  return { background: readableOn(hue, text), text };
}
