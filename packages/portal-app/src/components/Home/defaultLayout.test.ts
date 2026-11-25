import { ConfigReader } from '@backstage/config';
import type { HomePageWidgetData } from '@backstage/plugin-home-react/alpha';
import {
  DEFAULT_HOME_LAYOUT,
  readHomeLayout,
  toLayoutConfiguration,
} from './defaultLayout';

const widget = (
  name: string,
  height?: { defaultRows?: number; minRows?: number },
) => ({ name, layout: height ? { height } : undefined } as HomePageWidgetData);

describe('toLayoutConfiguration', () => {
  it('places cards side by side until the row is full', () => {
    expect(
      toLayoutConfiguration(
        [
          { widget: 'A', width: 4 },
          { widget: 'B', width: 4 },
          { widget: 'C', width: 4 },
        ],
        [],
      ).map(({ x, y }) => [x, y]),
    ).toEqual([
      [0, 0],
      [4, 0],
      [8, 0],
    ]);
  });

  it('wraps to a new row below the tallest card of the previous row', () => {
    const layout = toLayoutConfiguration(
      [
        { widget: 'A', width: 6, height: 3 },
        { widget: 'B', width: 6, height: 5 },
        { widget: 'C', width: 8 },
        { widget: 'D', width: 6 },
      ],
      [],
    );
    expect(layout.map(({ x, y }) => [x, y])).toEqual([
      [0, 0],
      [6, 0],
      [0, 5],
      [0, 9],
    ]);
  });

  it('stretches cards without an explicit height to the tallest in the row', () => {
    const layout = toLayoutConfiguration(
      [
        { widget: 'Short', width: 6 },
        { widget: 'Tall', width: 6 },
        { widget: 'Fixed', width: 4, height: 2 },
        { widget: 'Auto', width: 4 },
        { widget: 'Next', width: 12 },
      ],
      [widget('Tall', { defaultRows: 5 })],
    );
    expect(layout.map(({ y, height }) => [y, height])).toEqual([
      [0, 5],
      [0, 5],
      [5, 2],
      [5, 4],
      [9, 4],
    ]);
  });

  it("defaults height to the widget's defaultRows, then minRows, then 4", () => {
    const layout = toLayoutConfiguration(
      [
        { widget: 'Default', width: 12 },
        { widget: 'Min', width: 12 },
        { widget: 'Unknown', width: 12 },
      ],
      [
        widget('Default', { defaultRows: 6, minRows: 2 }),
        widget('Min', { minRows: 3 }),
      ],
    );
    expect(layout.map(l => l.height)).toEqual([6, 3, 4]);
  });

  it('clamps width to the grid and passes through lock flags', () => {
    expect(
      toLayoutConfiguration(
        [{ widget: 'A', width: 20, deletable: false, movable: false }],
        [],
      ),
    ).toEqual([
      {
        component: 'A',
        x: 0,
        y: 0,
        width: 12,
        height: 4,
        deletable: false,
        movable: false,
      },
    ]);
  });

  it('keeps the built-in default as two half-width cards', () => {
    expect(toLayoutConfiguration(DEFAULT_HOME_LAYOUT, [])).toEqual([
      { component: 'HomePageStarredEntities', x: 0, y: 0, width: 6, height: 4 },
      {
        component: 'OpenChoreoRecentlyVisited',
        x: 6,
        y: 0,
        width: 6,
        height: 4,
      },
    ]);
  });
});

describe('readHomeLayout', () => {
  const read = (defaultLayout?: unknown) =>
    readHomeLayout(
      new ConfigReader(
        defaultLayout === undefined
          ? {}
          : { openchoreo: { home: { defaultLayout } } },
      ),
    );

  it('falls back to the built-in default when unset', () => {
    expect(read()).toBe(DEFAULT_HOME_LAYOUT);
  });

  it('reads configured entries', () => {
    expect(
      read([
        { widget: 'A', width: 6 },
        { widget: 'B', width: 12, height: 5, deletable: false },
      ]),
    ).toEqual([
      { widget: 'A', width: 6 },
      { widget: 'B', width: 12, height: 5, deletable: false },
    ]);
  });

  it('skips malformed entries', () => {
    expect(
      read([
        { widget: 'A', width: 'wide' },
        { width: 6 },
        { widget: 'C', width: 0 },
        { widget: 'D', width: 6, height: -1 },
        { widget: 'E', width: 6 },
      ]),
    ).toEqual([{ widget: 'E', width: 6 }]);
  });
});
