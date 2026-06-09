import {
  ObservabilityMetrics,
  ObservabilityProjectRuntimeLogs,
  ObservabilityRuntimeEvents,
} from './plugin';

describe('openchoreo-observability', () => {
  it('Should export ObservabilityMetrics', () => {
    expect(ObservabilityMetrics).toBeDefined();
  });

  it('Should export ObservabilityProjectRuntimeLogs', () => {
    expect(ObservabilityProjectRuntimeLogs).toBeDefined();
  });

  it('Should export ObservabilityRuntimeEvents', () => {
    expect(ObservabilityRuntimeEvents).toBeDefined();
  });
});
