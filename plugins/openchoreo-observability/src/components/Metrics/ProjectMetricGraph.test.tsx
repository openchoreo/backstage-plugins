import { render, screen } from '@testing-library/react';
import { ProjectMetricGraph } from './ProjectMetricGraph';
import { componentColorResolver } from './colors';

let legendProps: any;

// Recharts renders to SVG via ResizeObserver, which jsdom does not provide.
// Stub the primitives so the test can assert on the series/legend the chart
// declares rather than on pixels.
jest.mock('recharts', () => ({
  LineChart: ({ children, ...rest }: any) => (
    <div data-testid="line-chart" data-points={(rest.data ?? []).length}>
      {children}
    </div>
  ),
  Line: ({ dataKey, name, stroke, strokeDasharray }: any) => (
    <div
      data-testid="line"
      data-key={dataKey}
      data-name={name}
      data-stroke={stroke}
      data-dash={strokeDasharray ?? 'solid'}
    />
  ),
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  // Recharts 3 builds the legend from the rendered <Line>s and dropped the
  // `payload` override, so the chart collapses and relabels via payloadUniqBy
  // and formatter. Capture both so the test can apply them to the real lines.
  Legend: (props: any) => {
    legendProps = props;
    return <div data-testid="legend" />;
  },
}));

const points = [
  { timestamp: '2026-03-05T10:00:00.000Z', value: 1 },
  { timestamp: '2026-03-05T10:01:00.000Z', value: 2 },
];

/** One metric's points for each named component, as `byMetric[key]` holds. */
const seriesFor = (names: string[]) =>
  Object.fromEntries(names.map(name => [name, points]));

const lines = () => screen.getAllByTestId('line');
const lineNames = () => lines().map(l => l.getAttribute('data-name'));

/** The legend entries recharts would show, given the lines the chart declared. */
const legendEntries = () => {
  const entries = lines().map(line => ({
    value: line.getAttribute('data-name'),
    dataKey: line.getAttribute('data-key'),
  }));
  const seen = new Set<string>();
  return entries
    .filter(entry => {
      const key = legendProps.payloadUniqBy(entry);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((entry, i) => legendProps.formatter(entry.value, entry, i));
};

describe('ProjectMetricGraph', () => {
  it('renders one line per component, in name order', () => {
    render(
      <ProjectMetricGraph
        series={seriesFor(['worker', 'api', 'db'])}
        colorOf={componentColorResolver(['api', 'db', 'worker'])}
        usageType="cpu"
        timeRange="1h"
      />,
    );

    expect(lines()).toHaveLength(3);
    expect(lineNames()).toEqual(['api', 'db', 'worker']);
  });

  it('gives each component its own colour', () => {
    render(
      <ProjectMetricGraph
        series={seriesFor(['api', 'db'])}
        colorOf={componentColorResolver(['api', 'db'])}
        usageType="cpu"
        timeRange="1h"
      />,
    );

    const colours = lines().map(l => l.getAttribute('data-stroke'));
    expect(new Set(colours).size).toBe(2);
  });

  it('draws every line solid', () => {
    render(
      <ProjectMetricGraph
        series={seriesFor(['api', 'db'])}
        colorOf={componentColorResolver(['api', 'db'])}
        usageType="cpu"
        timeRange="1h"
      />,
    );

    const dashes = lines().map(l => l.getAttribute('data-dash'));
    expect(dashes).toHaveLength(2);
    expect(dashes.every(dash => dash === 'solid')).toBe(true);
  });

  it('lists components in the legend, one entry each', () => {
    render(
      <ProjectMetricGraph
        series={seriesFor(['api', 'db'])}
        colorOf={componentColorResolver(['api', 'db'])}
        usageType="cpu"
        timeRange="1h"
      />,
    );

    expect(legendEntries()).toEqual(['api', 'db']);
  });

  it('plots a component whose name contains the old key separator', () => {
    render(
      <ProjectMetricGraph
        series={seriesFor(['a::b'])}
        colorOf={componentColorResolver(['a::b'])}
        usageType="cpu"
        timeRange="1h"
      />,
    );

    expect(lineNames()).toEqual(['a::b']);
  });

  it('renders the empty overlay and no lines for empty input', () => {
    render(
      <ProjectMetricGraph
        series={{}}
        colorOf={componentColorResolver([])}
        usageType="cpu"
        timeRange="1h"
      />,
    );

    expect(screen.queryAllByTestId('line')).toHaveLength(0);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('keeps a component on its own colour when another drops out', () => {
    const order = ['api', 'db'];
    const colorOf = componentColorResolver(order);

    const { rerender } = render(
      <ProjectMetricGraph
        series={seriesFor(order)}
        colorOf={colorOf}
        usageType="cpu"
        timeRange="1h"
      />,
    );
    const dbColour = lines()
      .filter(l => l.getAttribute('data-name') === 'db')
      .map(l => l.getAttribute('data-stroke'))[0];

    rerender(
      <ProjectMetricGraph
        series={seriesFor(['db'])}
        colorOf={colorOf}
        usageType="cpu"
        timeRange="1h"
      />,
    );

    expect(lines()).toHaveLength(1);
    expect(lines()[0].getAttribute('data-stroke')).toBe(dbColour);
  });

  it('keeps the colour palette bounded for a large project', () => {
    const names = Array.from({ length: 24 }, (_, i) => `component-${i}`);
    render(
      <ProjectMetricGraph
        series={seriesFor(names)}
        colorOf={componentColorResolver(names)}
        usageType="cpu"
        timeRange="1h"
      />,
    );

    expect(lines()).toHaveLength(24);
    // Every component still gets its line; the palette cycles rather than
    // inventing 24 near-identical hues. Palette has 10 entries.
    const colours = new Set(lines().map(l => l.getAttribute('data-stroke')));
    expect(colours.size).toBe(10);
  });
});
