import type { Config } from '@backstage/config';
import type { LayoutConfiguration } from '@backstage/plugin-home';
import type { HomePageWidgetData } from '@backstage/plugin-home-react/alpha';

const GRID_COLUMNS = 12;
const DEFAULT_ROWS = 4;

export interface HomeLayoutItem {
  widget: string;
  width: number;
  height?: number;
  movable?: boolean;
  deletable?: boolean;
  resizable?: boolean;
}

export const DEFAULT_HOME_LAYOUT: HomeLayoutItem[] = [
  { widget: 'HomePageStarredEntities', width: 6 },
  { widget: 'OpenChoreoRecentlyVisited', width: 6 },
];

// Reads `openchoreo.home.defaultLayout`, skipping malformed entries.
export const readHomeLayout = (config: Config): HomeLayoutItem[] => {
  const entries = config.getOptionalConfigArray(
    'openchoreo.home.defaultLayout',
  );
  if (!entries) return DEFAULT_HOME_LAYOUT;

  return entries.flatMap(entry => {
    try {
      const width = entry.getNumber('width');
      const height = entry.getOptionalNumber('height');
      if (width < 1 || (height !== undefined && height < 1)) return [];
      return [
        {
          widget: entry.getString('widget'),
          width,
          height,
          movable: entry.getOptionalBoolean('movable'),
          deletable: entry.getOptionalBoolean('deletable'),
          resizable: entry.getOptionalBoolean('resizable'),
        },
      ];
    } catch {
      return [];
    }
  });
};

const defaultHeight = (name: string, widgets: HomePageWidgetData[]) => {
  const height = widgets.find(w => w.name === name)?.layout?.height;
  return height?.defaultRows ?? height?.minRows ?? DEFAULT_ROWS;
};

// Wraps cards like MUI Grid items; cards without a height stretch to the row.
export const toLayoutConfiguration = (
  items: HomeLayoutItem[],
  widgets: HomePageWidgetData[],
): LayoutConfiguration[] => {
  const rows: { entry: LayoutConfiguration; stretch: boolean }[][] = [];
  let x = GRID_COLUMNS;
  let y = 0;

  for (const { widget, width: requestedWidth, height, ...flags } of items) {
    const width = Math.min(requestedWidth, GRID_COLUMNS);
    if (x + width > GRID_COLUMNS) {
      const previous = rows[rows.length - 1] ?? [];
      y += Math.max(0, ...previous.map(c => c.entry.height));
      x = 0;
      rows.push([]);
    }
    rows[rows.length - 1].push({
      entry: {
        component: widget,
        x,
        y,
        width,
        height: height ?? defaultHeight(widget, widgets),
        ...flags,
      },
      stretch: height === undefined,
    });
    x += width;
  }

  return rows.flatMap(row => {
    const rowHeight = Math.max(...row.map(c => c.entry.height));
    return row.map(({ entry, stretch }) =>
      stretch ? { ...entry, height: rowHeight } : entry,
    );
  });
};
