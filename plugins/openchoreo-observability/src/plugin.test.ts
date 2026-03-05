import {
  ObservabilityMetrics,
  ObservabilityProjectRuntimeLogs,
} from './plugin';

describe('openchoreo-observability', () => {
  it('Should export ObservabilityMetrics', () => {
    expect(ObservabilityMetrics).toBeDefined();
  });

  it('Should export ObservabilityProjectRuntimeLogs', () => {
    expect(ObservabilityProjectRuntimeLogs).toBeDefined();
  });
});
