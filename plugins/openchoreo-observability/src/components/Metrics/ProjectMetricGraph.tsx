import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LegendPayload,
} from 'recharts';
import { MetricSeriesMap, SeriesByComponent } from '../../types';
import {
  formatAxisTime,
  formatTooltipTime,
  formatMetricValue,
  formatMetricName,
  calculateTimeDomain,
  calculateProjectMemoryYAxis,
  transformProjectMetricsData,
  getMetricConfigs,
  getLineOpacity,
} from './utils';
import { useMetricGraphStyles } from './styles';
import { ChartTooltip } from './ChartTooltip';

interface ProjectMetricGraphProps {
  /** componentName -> that component's series, from `buildProjectSeries`. */
  seriesByComponent: SeriesByComponent;
  /** Line colour for a component. The caller owns what colour means. */
  colorOf: (component: string) => string;
  usageType: 'cpu' | 'memory' | 'networkThroughput' | 'networkLatency';
  timeRange?: string;
  customStartTime?: string;
  customEndTime?: string;
}

/**
 * Mode 2 chart: the same metrics `MetricGraphByComponent` plots — usage,
 * requests, limits — for each selected component on shared axes.
 *
 * Colour carries the component, and every line is solid. Within one colour the
 * metrics are told apart by the tooltip, which names each row, and by shape:
 * requests and limits are flat, usage is not. The legend lists components only
 * — one entry each, not one per line — and hovering an entry lights that
 * component's lines.
 *
 * Input stays grouped by component. The unique `dataKey` Recharts needs per
 * line is generated here and never leaves this file, so no component name has
 * to survive a round trip through a composite key.
 *
 * The default project view does not use this chart; it renders the aggregate
 * with `MetricGraphByComponent`, exactly as the component page does.
 */
export const ProjectMetricGraph = ({
  seriesByComponent,
  colorOf,
  usageType,
  timeRange,
  customStartTime,
  customEndTime,
}: ProjectMetricGraphProps) => {
  const classes = useMetricGraphStyles();
  const [hoveredComponent, setHoveredComponent] = useState<
    string | undefined
  >();

  // One entry per plotted line. Components are sorted so colour and legend
  // order stay stable, and each component's metrics follow the component
  // chart's order so the two tabs stack their lines the same way. A component
  // whose every series is empty contributes nothing — keeping it would put an
  // entry in the legend with nothing to hover.
  const lines = useMemo(() => {
    const metricKeys = Object.values(getMetricConfigs(usageType)).map(
      config => config.key,
    );

    return Object.keys(seriesByComponent)
      .filter(component =>
        Object.values(seriesByComponent[component]).some(
          points => (points?.length ?? 0) > 0,
        ),
      )
      .sort()
      .flatMap(component =>
        Object.entries(seriesByComponent[component])
          .sort(([a], [b]) => metricKeys.indexOf(a) - metricKeys.indexOf(b))
          .map(([metricKey, points]) => ({ component, metricKey, points })),
      )
      .map((line, index) => ({ dataKey: `s${index}`, ...line }));
  }, [seriesByComponent, usageType]);

  // Recharts hands the legend a `dataKey`; this is how the component behind one
  // is recovered, so the key itself never has to carry the name.
  const componentOf = useMemo(() => {
    const byDataKey = new Map(
      lines.map(line => [line.dataKey, line.component]),
    );
    return (dataKey: unknown) => byDataKey.get(String(dataKey));
  }, [lines]);

  const plotted: MetricSeriesMap = useMemo(
    () => Object.fromEntries(lines.map(line => [line.dataKey, line.points])),
    [lines],
  );

  const transformedData = useMemo(
    () => transformProjectMetricsData(plotted),
    [plotted],
  );

  const { ticks, daysRange, domain } = useMemo(
    () =>
      calculateTimeDomain(transformedData, timeRange, 5, {
        startTime: customStartTime,
        endTime: customEndTime,
      }),
    [transformedData, timeRange, customStartTime, customEndTime],
  );

  const memoryYAxis = useMemo(
    () =>
      usageType === 'memory' ? calculateProjectMemoryYAxis(plotted) : undefined,
    [usageType, plotted],
  );

  const handleMouseEnter = (payload: LegendPayload) =>
    setHoveredComponent(componentOf(payload.dataKey));

  const handleMouseLeave = () => setHoveredComponent(undefined);

  return (
    <div className={classes.chartContainer}>
      {transformedData.length === 0 && (
        <div className={classes.emptyOverlay}>No data available</div>
      )}
      <LineChart
        className={classes.lineChart}
        responsive
        data={transformedData}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="timestamp"
          type="number"
          domain={domain}
          tickFormatter={ts => formatAxisTime(ts, daysRange)}
          ticks={ticks}
          tick={{ fontSize: 12 }}
        />
        <YAxis
          width="auto"
          tickFormatter={v => formatMetricValue(v, usageType)}
          ticks={memoryYAxis?.ticks}
          domain={memoryYAxis?.domain}
        />
        <Tooltip
          content={
            <ChartTooltip
              labelFormatter={formatTooltipTime}
              formatter={(value: number) => formatMetricValue(value, usageType)}
            />
          }
        />
        {/* One entry per component, not per line. Recharts 3 builds the legend
            from the rendered <Line>s and dropped the `payload` override, so the
            3N entries are collapsed with `payloadUniqBy` and relabelled from
            the line name ("api · CPU Usage") down to the component ("api").
            Bounded height + scroll so a project with many components can't push
            the chart out of its card. */}
        <Legend
          payloadUniqBy={entry => componentOf(entry.dataKey)}
          formatter={(_value, entry) => componentOf(entry.dataKey)}
          wrapperStyle={{ maxHeight: 72, overflowY: 'auto' }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        />
        {lines.map(line => (
          <Line
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            name={`${line.component} · ${formatMetricName(line.metricKey)}`}
            stroke={colorOf(line.component)}
            strokeOpacity={getLineOpacity(line.component, hoveredComponent)}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls={false}
          />
        ))}
      </LineChart>
    </div>
  );
};
