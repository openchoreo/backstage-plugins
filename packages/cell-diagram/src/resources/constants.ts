/**
 * Light-theme palette retained as a value export for callers that import
 * `Colors` directly. The `<CellDiagram>` component now resolves colors at
 * runtime through the theme provider — see `../theme/colors.ts` and
 * `../theme/CellDiagramThemeProvider.tsx`. Importing this object continues
 * to work but is *not* theme-aware; new code should consume `useColors()`
 * or `({ theme }) => theme.colors.X` inside `styled` template literals.
 */
import { CellDiagramColors, lightColors } from '../theme/colors';

export const Colors: CellDiagramColors = lightColors;
// Intentional value + type colocation: `Colors.PRIMARY` (value) and `: Colors`
// (type) are both part of the public API and must keep working (see README
// migration note). The value/type merge is deliberate, not a redeclaration bug.
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type Colors = CellDiagramColors;

export const LINK_WIDTH = {
  DEFAULT: 2,
  PREVIEW: 4,
};

export const ICON_SCALE = {
  DEFAULT: 1,
  PREVIEW: 1.5,
};

export const MARGIN = {
  DEFAULT: 40,
  PREVIEW: 0,
};

export const NAME_JOIN_CHAR = '|';

// error messages
export const NO_ENTITIES_DETECTED =
  'Could not detect any components in the project.';
export const ERRONEOUS_MODEL =
  'Please resolve the diagnostics to view the cell diagram.';
export const NO_CELL_NODE = 'Could not detect cell.';

// node types
export const PROJECT_NODE = 'projectNode';
export const COMPONENT_NODE = 'componentNode';
export const CONNECTION_NODE = 'connectionNode';
export const MAIN_CELL = 'mainCell';
export const EMPTY_NODE = 'emptyNode';
export const EXTERNAL_NODE = 'externalNode';
export const BORDER_NODE = 'borderNode';

// link types
export const PROJECT_LINK = 'projectLink';
export const COMPONENT_LINK = 'componentLink';
export const CONNECTION_LINK = 'connectionLink';
export const CELL_LINK = 'cellLink';
export const EXTERNAL_LINK = 'externalLink';

// node dimensions
export const MAIN_CELL_DEFAULT_HEIGHT = 500;
export const CELL_LINE_MIN_WIDTH = 3;
export const CELL_LINE_PREVIEW_WIDTH = 2;
export const CIRCLE_WIDTH = 60;
export const DOT_WIDTH = 20;

export const COMPONENT_CIRCLE_WIDTH = 80;
export const COMPONENT_LINE_MIN_WIDTH = 3;
export const COMPONENT_LINE_PREVIEW_WIDTH = 2;

export const LINE_MIN_WIDTH = 2;
export const LINE_MAX_WIDTH = 10;

export const LABEL_FONT_SIZE = 20;
export const LABEL_MAX_WIDTH = 200;

export const BORDER_GAP = 40;
export const DIAGRAM_END = 1000;
