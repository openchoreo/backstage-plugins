import { PALETTE_LIGHT, PALETTE_DARK } from '../CostInsights/chartUtils';

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
