import { useState, useMemo } from 'react';
import { Box } from '@material-ui/core';
import { Trace as TraceData } from './WaterfallView';
import { dummyTracesData } from './dummyTraceData';
import { TracesFilter, TracesFilters } from './TracesFilter';
import { TracesActions } from './TracesActions';
import { TracesTable, Trace } from './TracesTable';
import { Environment } from '../../types';

// Convert to table format
const convertToTableFormat = (traces: TraceData[]): Trace[] => {
  return traces.map(trace => {
    const times = trace.spans.flatMap(span => [
      new Date(span.startTime).getTime(),
      new Date(span.endTime).getTime(),
    ]);
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    return {
      traceId: trace.traceId,
      start_time: new Date(minTime).toISOString(),
      end_time: new Date(maxTime).toISOString(),
      duration: maxTime - minTime,
      number_of_spans: trace.spans.length,
      spans: trace.spans,
    };
  });
};

export const ObservabilityTracesPage = () => {
  const [filters, setFilters] = useState<TracesFilters>({
    searchQuery: '',
    environmentId: '',
    timeRange: '1h',
  });

  // TODO: Replace with actual environments from API
  const environments: Environment[] = [];
  const environmentsLoading = false;

  const traces = useMemo(() => convertToTableFormat(dummyTracesData), []);
  const tracesDataMap = useMemo(() => {
    const map = new Map<string, TraceData>();
    dummyTracesData.forEach(trace => {
      map.set(trace.traceId, trace);
    });
    return map;
  }, []);

  const handleFiltersChange = (newFilters: Partial<TracesFilters>) => {
    setFilters((prev: TracesFilters) => ({ ...prev, ...newFilters }));
  };

  const handleRefresh = () => {
    // TODO: Implement refresh logic
  };

  const filteredTraces = traces.filter(trace =>
    trace.traceId.toLowerCase().includes(filters.searchQuery.toLowerCase())
  );

  return (
    <Box>
      <TracesFilter
        filters={filters}
        onFiltersChange={handleFiltersChange}
        environments={environments}
        environmentsLoading={environmentsLoading}
      />

      <TracesActions
        totalCount={filteredTraces.length}
        disabled={false}
        onRefresh={handleRefresh}
      />

      <TracesTable
        traces={filteredTraces}
        tracesDataMap={tracesDataMap}
        loading={false}
      />
    </Box>
  );
};
