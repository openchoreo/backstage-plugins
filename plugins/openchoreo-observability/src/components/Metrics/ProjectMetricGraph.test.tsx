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

/** Full cpu group (usage/requests/limits) for each named component. */
const cpuFor = (names: string[]) =>
  Object.fromEntries(
    names.map(name => [
      name,
      { cpuUsage: points, cpuRequests: points, cpuLimits: points },
    ]),
  );

const lines = () => screen.getAllByTestId('line');

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
  it('renders three lines per component', () => {
    render(
      <ProjectMetricGraph
        seriesByComponent={cpuFor(['api', 'db', 'worker'])}
        colorOf={componentColorResolver(['api', 'db', 'worker'])}
        usageType="cpu"
        timeRange="1h"
      />,
    );

    expect(lines()).toHaveLength(9);
  });

  it("gives all three of a component's lines its one colour", () => {
    render(
      <ProjectMetricGraph
        seriesByComponent={cpuFor(['api', 'db'])}
        colorOf={componentColorResolver(['api', 'db'])}
        usageType="cpu"
        timeRange="1h"
      />,
    );

    const byComponent = new Map<string, Set<string>>();
    lines().forEach(line => {
      const component = line.getAttribute('data-name')!.split(' · ')[0];
      const colours = byComponent.get(component) ?? new Set<string>();
      colours.add(line.getAttribute('data-stroke')!);
      byComponent.set(component, colours);
    });

    expect([...byComponent.keys()].sort()).toEqual(['api', 'db']);
    byComponent.forEach(colours => expect(colours.size).toBe(1));
    const allColours = new Set(
      [...byComponent.values()].flatMap(set => [...set]),
    );
    expect(allColours.size).toBe(2);
  });

  it('draws every line solid', () => {
    render(
      <ProjectMetricGraph
        seriesByComponent={cpuFor(['api', 'db'])}
        colorOf={componentColorResolver(['api', 'db'])}
        usageType="cpu"
        timeRange="1h"
      />,
    );

    const dashes = lines().map(l => l.getAttribute('data-dash'));
    expect(dashes).toHaveLength(6);
    expect(dashes.every(dash => dash === 'solid')).toBe(true);
  });

  it('names each line with its component and metric', () => {
    render(
      <ProjectMetricGraph
        seriesByComponent={cpuFor(['api'])}
        colorOf={componentColorResolver(['api'])}
        usageType="cpu"
        timeRange="1h"
      />,
    );

    expect(lines().map(l => l.getAttribute('data-name'))).toEqual([
      'api · CPU Usage',
      'api · CPU Requests',
      'api · CPU Limits',
    ]);
  });

  it('lists components in the legend, one entry each rather than one per line', () => {
    render(
      <ProjectMetricGraph
        seriesByComponent={cpuFor(['api', 'db'])}
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
        seriesByComponent={cpuFor(['a::b'])}
        colorOf={componentColorResolver(['a::b'])}
        usageType="cpu"
        timeRange="1h"
      />,
    );

    expect(lines()).toHaveLength(3);
    expect(legendEntries()).toEqual(['a::b']);
  });

  it('renders the empty overlay and no lines for empty input', () => {
    render(
      <ProjectMetricGraph
        seriesByComponent={{}}
        colorOf={componentColorResolver([])}
        usageType="cpu"
        timeRange="1h"
      />,
    );

    expect(screen.queryAllByTestId('line')).toHaveLength(0);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('drops a component whose every series is empty instead of throwing', () => {
    render(
      <ProjectMetricGraph
        seriesByComponent={{
          ...cpuFor(['api']),
          silent: { cpuUsage: [], cpuRequests: [], cpuLimits: [] },
        }}
        colorOf={componentColorResolver(['api', 'silent'])}
        usageType="cpu"
        timeRange="1h"
      />,
    );

    expect(lines()).toHaveLength(3);
    expect(legendEntries()).toEqual(['api']);
  });

  it('keeps a component on its own colour when another drops out', () => {
    const order = ['api', 'db'];
    const colorOf = componentColorResolver(order);

    const { rerender } = render(
      <ProjectMetricGraph
        seriesByComponent={cpuFor(order)}
        colorOf={colorOf}
        usageType="cpu"
        timeRange="1h"
      />,
    );
    const dbColour = lines()
      .filter(l => l.getAttribute('data-name')!.startsWith('db'))
      .map(l => l.getAttribute('data-stroke'))[0];

    rerender(
      <ProjectMetricGraph
        seriesByComponent={{
          api: { cpuUsage: [], cpuRequests: [], cpuLimits: [] },
          ...cpuFor(['db']),
        }}
        colorOf={colorOf}
        usageType="cpu"
        timeRange="1h"
      />,
    );

    expect(lines()).toHaveLength(3);
    expect(lines()[0].getAttribute('data-stroke')).toBe(dbColour);
  });

  it('keeps the colour palette bounded for a large project', () => {
    const names = Array.from({ length: 24 }, (_, i) => `component-${i}`);
    render(
      <ProjectMetricGraph
        seriesByComponent={cpuFor(names)}
        colorOf={componentColorResolver(names)}
        usageType="cpu"
        timeRange="1h"
      />,
    );

    expect(lines()).toHaveLength(72);
    // Every component still gets its lines; the palette cycles rather than
    // inventing 24 near-identical hues.
    const colours = new Set(lines().map(l => l.getAttribute('data-stroke')));
    expect(colours.size).toBe(12);
  });
});
