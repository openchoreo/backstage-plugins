/**
 * Distinct line colours for project-level charts, where each line is a
 * component rather than a fixed metric. Same values as `CostInsightsGraph`'s
 * `PALETTE_LIGHT`/`PALETTE_DARK` — muted mid-tones that meet WCAG 2.2 AA /
 * BITV 2.0, so the chart looks the same "weight" in light and dark mode.
 * Deliberately bounded — beyond this many components the palette cycles
 * instead of generating unreadable near-duplicate hues; the legend
 * (scrollable) remains the source of truth for identity.
 */
const PALETTE_LIGHT = [
  '#3f6cb0', // blue
  '#2f8f7a', // teal
  '#b06636', // rust
  '#845bb0', // violet
  '#a53f63', // rose
  '#6f7a2f', // olive
  '#2f8fae', // cyan
  '#8a6a34', // brown
  '#6f727a', // grey
  '#993f8f', // magenta
];
const PALETTE_DARK = [
  '#8fa8e0', // blue
  '#4fc0a4', // teal
  '#e0a074', // rust
  '#bb9fe0', // violet
  '#e07f9f', // rose
  '#b6c470', // olive
  '#5fc0e0', // cyan
  '#a7adb8', // grey
  '#d8c85f', // yellow
  '#d98fd0', // magenta
];

/** Stable colour for the component at `index` in the chart's series order. */
export const getComponentLineColor = (
  index: number,
  dark: boolean = false,
): string => {
  const palette = dark ? PALETTE_DARK : PALETTE_LIGHT;
  return palette[index % palette.length];
};

/**
 * Resolve a stable colour per component over a fixed component order, so a
 * component keeps its colour when another drops out of the chart for having no
 * data in the selected window.
 */
export const componentColorResolver = (
  components: string[],
  dark: boolean = false,
): ((component: string) => string) => {
  const indexOf = new Map(
    [...components].sort().map((name, index) => [name, index] as const),
  );
  return component =>
    getComponentLineColor(indexOf.get(component) ?? 0, dark);
};
