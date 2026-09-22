import {
  PALETTE_LIGHT,
  PALETTE_DARK,
  buildColorMap,
} from '../CostInsights/chartUtils';

/**
 * Resolve a stable colour per component over a fixed component order, so a
 * component keeps its colour when another drops out of the chart for having no
 * data in the selected window.
 */
export const componentColorResolver = (
  components: string[],
  dark: boolean = false,
): ((component: string) => string) => {
  const palette = dark ? PALETTE_DARK : PALETTE_LIGHT;
  const colorMap = buildColorMap([...components].sort(), palette);
  return component => colorMap.get(component) ?? palette[0];
};
