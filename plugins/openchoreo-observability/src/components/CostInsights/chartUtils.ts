// Shared chart helpers so the stacked-bar and line charts render identically.

// Muted mid-tone categorical palettes; each meets WCAG 2.2 AA / BITV 2.0.
export const PALETTE_LIGHT = [
  '#3f6cb0',
  '#2f8f7a',
  '#b06636',
  '#845bb0',
  '#a53f63',
  '#6f7a2f',
  '#2f8fae',
  '#8a6a34',
  '#6f727a',
  '#993f8f',
];
export const PALETTE_DARK = [
  '#8fa8e0',
  '#4fc0a4',
  '#e0a074',
  '#bb9fe0',
  '#e07f9f',
  '#b6c470',
  '#5fc0e0',
  '#a7adb8',
  '#d8c85f',
  '#d98fd0',
];

export const FILL_OPACITY = 0.9;

export const MAX_BAR_SIZE = 64;
export const MIN_BUCKET_WIDTH = 48;

/** Green used for savings/recommendation overlays, theme-aware. */
export const savingColor = (dark: boolean): string =>
  dark ? '#4fc0a4' : '#2f8f7a';

/** Deterministic per-key colour map that wraps when keys exceed the palette. */
export function buildColorMap(
  keys: string[],
  palette: string[],
): Map<string, string> {
  const map = new Map<string, string>();
  keys.forEach((key, i) => map.set(key, palette[i % palette.length]));
  return map;
}

// Costs are often sub-dollar; scale decimal precision to the axis range so
// small values don't all collapse to "$0".
export const formatAxisCost = (value: number): string => {
  if (value === 0) return '$0';
  const abs = Math.abs(value);
  let digits = 0;
  if (abs < 0.01) digits = 4;
  else if (abs < 0.1) digits = 3;
  else if (abs < 1) digits = 2;
  else if (abs < 10) digits = 1;
  return `$${value.toFixed(digits)}`;
};

export const formatBucket = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};
