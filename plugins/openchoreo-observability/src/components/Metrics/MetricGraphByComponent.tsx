import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LegendPayload } from 'recharts';
import { DataKey } from 'recharts/types/util/types';

// Dummy data for the metric graph
const data = {
  "cpuUsage": [
      { "time": "2025-11-10T11:00:56Z", "value": 0.000003867434507678883 },
      { "time": "2025-11-10T11:05:56Z", "value": 0.000003069435004713802 },
      { "time": "2025-11-10T11:10:56Z", "value": 0.000002634371226812141 },
      { "time": "2025-11-10T11:15:56Z", "value": 0.000004123456789012345 },
      { "time": "2025-11-10T11:20:56Z", "value": 0.000005234567890123456 },
      { "time": "2025-11-10T11:25:56Z", "value": 0.000004567890123456789 },
      { "time": "2025-11-10T11:30:56Z", "value": 0.000003789012345678901 },
      { "time": "2025-11-10T11:35:56Z", "value": 0.000002890123456789012 },
      { "time": "2025-11-10T11:40:56Z", "value": 0.000003456789012345678 },
      { "time": "2025-11-10T11:45:56Z", "value": 0.000004890123456789012 },
      { "time": "2025-11-10T11:50:56Z", "value": 0.000006123456789012345 },
      { "time": "2025-11-10T11:55:56Z", "value": 0.000005678901234567890 },
      { "time": "2025-11-10T12:00:56Z", "value": 0.000004234567890123456 },
      { "time": "2025-11-10T12:05:56Z", "value": 0.000003567890123456789 },
      { "time": "2025-11-10T12:10:56Z", "value": 0.000002901234567890123 },
      { "time": "2025-11-10T12:15:56Z", "value": 0.000003234567890123456 },
      { "time": "2025-11-10T12:20:56Z", "value": 0.000004567890123456789 },
      { "time": "2025-11-10T12:25:56Z", "value": 0.000005890123456789012 },
      { "time": "2025-11-10T12:30:56Z", "value": 0.000007123456789012345 },
      { "time": "2025-11-10T12:35:56Z", "value": 0.000006456789012345678 },
      { "time": "2025-11-10T12:40:56Z", "value": 0.000005234567890123456 },
      { "time": "2025-11-10T12:45:56Z", "value": 0.000004123456789012345 },
      { "time": "2025-11-10T12:50:56Z", "value": 0.000003456789012345678 },
      { "time": "2025-11-10T12:55:56Z", "value": 0.000002789012345678901 },
      { "time": "2025-11-10T13:00:56Z", "value": 0.000003123456789012345 }
  ],
  "cpuRequests": [
      { "time": "2025-11-10T11:00:56Z", "value": 0.00001 },
      { "time": "2025-11-10T11:05:56Z", "value": 0.00001 },
      { "time": "2025-11-10T11:10:56Z", "value": 0.00001 },
      { "time": "2025-11-10T11:15:56Z", "value": 0.00001 },
      { "time": "2025-11-10T11:20:56Z", "value": 0.00001 },
      { "time": "2025-11-10T11:25:56Z", "value": 0.00001 },
      { "time": "2025-11-10T11:30:56Z", "value": 0.00001 },
      { "time": "2025-11-10T11:35:56Z", "value": 0.00001 },
      { "time": "2025-11-10T11:40:56Z", "value": 0.00001 },
      { "time": "2025-11-10T11:45:56Z", "value": 0.00001 },
      { "time": "2025-11-10T11:50:56Z", "value": 0.00001 },
      { "time": "2025-11-10T11:55:56Z", "value": 0.00001 },
      { "time": "2025-11-10T12:00:56Z", "value": 0.00001 },
      { "time": "2025-11-10T12:05:56Z", "value": 0.00001 },
      { "time": "2025-11-10T12:10:56Z", "value": 0.00001 },
      { "time": "2025-11-10T12:15:56Z", "value": 0.00001 },
      { "time": "2025-11-10T12:20:56Z", "value": 0.00001 },
      { "time": "2025-11-10T12:25:56Z", "value": 0.00001 },
      { "time": "2025-11-10T12:30:56Z", "value": 0.00001 },
      { "time": "2025-11-10T12:35:56Z", "value": 0.00001 },
      { "time": "2025-11-10T12:40:56Z", "value": 0.00001 },
      { "time": "2025-11-10T12:45:56Z", "value": 0.00001 },
      { "time": "2025-11-10T12:50:56Z", "value": 0.00001 },
      { "time": "2025-11-10T12:55:56Z", "value": 0.00001 },
      { "time": "2025-11-10T13:00:56Z", "value": 0.00001 }
  ],
  "cpuLimits": [
      { "time": "2025-11-10T11:00:56Z", "value": 0.00004 },
      { "time": "2025-11-10T11:05:56Z", "value": 0.00004 },
      { "time": "2025-11-10T11:10:56Z", "value": 0.00004 },
      { "time": "2025-11-10T11:15:56Z", "value": 0.00004 },
      { "time": "2025-11-10T11:20:56Z", "value": 0.00004 },
      { "time": "2025-11-10T11:25:56Z", "value": 0.00004 },
      { "time": "2025-11-10T11:30:56Z", "value": 0.00004 },
      { "time": "2025-11-10T11:35:56Z", "value": 0.00004 },
      { "time": "2025-11-10T11:40:56Z", "value": 0.00004 },
      { "time": "2025-11-10T11:45:56Z", "value": 0.00004 },
      { "time": "2025-11-10T11:50:56Z", "value": 0.00004 },
      { "time": "2025-11-10T11:55:56Z", "value": 0.00004 },
      { "time": "2025-11-10T12:00:56Z", "value": 0.00004 },
      { "time": "2025-11-10T12:05:56Z", "value": 0.00004 },
      { "time": "2025-11-10T12:10:56Z", "value": 0.00004 },
      { "time": "2025-11-10T12:15:56Z", "value": 0.00004 },
      { "time": "2025-11-10T12:20:56Z", "value": 0.00004 },
      { "time": "2025-11-10T12:25:56Z", "value": 0.00004 },
      { "time": "2025-11-10T12:30:56Z", "value": 0.00004 },
      { "time": "2025-11-10T12:35:56Z", "value": 0.00004 },
      { "time": "2025-11-10T12:40:56Z", "value": 0.00004 },
      { "time": "2025-11-10T12:45:56Z", "value": 0.00004 },
      { "time": "2025-11-10T12:50:56Z", "value": 0.00004 },
      { "time": "2025-11-10T12:55:56Z", "value": 0.00004 },
      { "time": "2025-11-10T13:00:56Z", "value": 0.00004 }
  ]
};

// #endregion
export const MetricGraphByComponent = () => {
  const [hoveringDataKey, setHoveringDataKey] = React.useState<DataKey<any> | undefined>(undefined);

  // Transform the data structure to be compatible with Recharts
  const transformedData = React.useMemo(() => {
    const timeMap = new Map<string, any>();

    // Collect all unique timestamps
    Object.entries(data).forEach(([metricName, metricData]) => {
      metricData.forEach((point: any) => {
        if (!timeMap.has(point.time)) {
          timeMap.set(point.time, { time: point.time });
        }
        timeMap.get(point.time)[metricName] = point.value;
      });
    });

    return Array.from(timeMap.values()).sort((a, b) =>
      new Date(a.time).getTime() - new Date(b.time).getTime()
    );
  }, []);

  // Dynamic opacity for all metric lines
  const getOpacity = (metricKey: string) => {
    if (!hoveringDataKey) return 1;
    return hoveringDataKey === metricKey ? 1 : 0.5;
  };

  const handleMouseEnter = (payload: LegendPayload) => {
    setHoveringDataKey(payload.dataKey);
  };

  const handleMouseLeave = () => {
    setHoveringDataKey(undefined);
  };

  // Format time for display
  const formatTime = (time: string) => {
    const date = new Date(time);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatValue = (value: number) => {
    if (value > 1) {
      return `${value.toFixed(4)}`;
    } else if (value > 0.001) {
      return `${(value * 1000).toFixed(2)} mCPU`;
    } else {
      return `${(value * 1000000).toFixed(2)} uCPU`;
    }
  };

  return (
    <div style={{ width: '100%' }}>
      <LineChart
        style={{ width: '100%', maxWidth: '100%', maxHeight: '70vh', aspectRatio: 1.618 }}
        responsive
        data={transformedData}
        margin={{
          top: 20,
          right: 0,
          left: 0,
          bottom: 0,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" tickFormatter={formatTime} />
        <YAxis width="auto" tickFormatter={formatValue} />
        <Tooltip labelFormatter={formatTime} />
        <Legend onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} />
        <Line
          type="monotone"
          dataKey="cpuUsage"
          name="CPU Usage"
          strokeOpacity={getOpacity('cpuUsage')}
          stroke="#8884d8"
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="cpuRequests"
          name="CPU Requests"
          strokeOpacity={getOpacity('cpuRequests')}
          stroke="#82ca9d"
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="cpuLimits"
          name="CPU Limits"
          strokeOpacity={getOpacity('cpuLimits')}
          stroke="#ffc658"
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </div>
  );
};
