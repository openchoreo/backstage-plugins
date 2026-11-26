import {
  alertCounts,
  alertCountsResolved,
  alertWindow,
  configuredTraits,
  createsAlertRule,
  environmentAlerts,
  incidentCounts,
  type EnvironmentAlerts,
} from './alertingFacts';

describe('configuredTraits', () => {
  it('lists Component and embedded traits with their default kinds', () => {
    expect(
      configuredTraits({
        componentTraits: [
          { name: 'alert', instanceName: 'a' },
          { kind: 'ClusterTrait', name: 'alert', instanceName: 'b' },
        ],
        typeTraits: [{ name: 'observability', instanceName: 'o' }],
      }),
    ).toEqual([
      { kind: 'Trait', name: 'alert' },
      { kind: 'ClusterTrait', name: 'alert' },
      { kind: 'Trait', name: 'observability' },
    ]);
  });

  it('defaults embedded traits of a ClusterComponentType to ClusterTrait', () => {
    expect(
      configuredTraits({
        typeTraits: [{ name: 'observability', instanceName: 'o' }],
        clusterScopedType: true,
      }),
    ).toEqual([{ kind: 'ClusterTrait', name: 'observability' }]);
  });

  it("adds a line's traits that match no Component trait", () => {
    expect(
      configuredTraits({
        componentTraits: [{ kind: 'Trait', name: 'alert', instanceName: 'a' }],
        lineTraits: [
          { kind: 'Trait', name: 'alert', instanceName: 'b' },
          { kind: 'ClusterTrait', name: 'alert', instanceName: 'a' },
        ],
      }),
    ).toEqual([
      { kind: 'Trait', name: 'alert' },
      { kind: 'Trait', name: 'alert' },
      { kind: 'ClusterTrait', name: 'alert' },
    ]);
  });

  it('treats a line trait matching a Component trait as the same instance, an empty kind counting as Trait', () => {
    expect(
      configuredTraits({
        componentTraits: [{ name: 'alert', instanceName: 'a' }],
        lineTraits: [{ kind: 'Trait', name: 'alert', instanceName: 'a' }],
      }),
    ).toEqual([{ kind: 'Trait', name: 'alert' }]);
  });

  it('counts a line trait once when the line lists it twice, as OpenChoreo merges each into the growing list', () => {
    expect(
      configuredTraits({
        lineTraits: [
          { name: 'alert', instanceName: 'errors' },
          { kind: 'Trait', name: 'alert', instanceName: 'errors' },
        ],
      }),
    ).toEqual([{ kind: 'Trait', name: 'alert' }]);
  });

  it("adds a line trait that matches only an embedded trait, as OpenChoreo merges against the Component's own", () => {
    expect(
      configuredTraits({
        typeTraits: [{ name: 'alert', instanceName: 'a' }],
        lineTraits: [{ name: 'alert', instanceName: 'a' }],
      }),
    ).toHaveLength(2);
  });
});

describe('createsAlertRule', () => {
  it('recognises a trait that creates an ObservabilityAlertRule', () => {
    expect(
      createsAlertRule({
        creates: [
          { template: { kind: 'ConfigMap' } },
          { template: { kind: 'ObservabilityAlertRule' } },
        ],
      }),
    ).toBe(true);
  });

  it('rejects a trait that creates other kinds or nothing', () => {
    expect(createsAlertRule({ creates: [{ template: { kind: 'HPA' } }] })).toBe(
      false,
    );
    expect(createsAlertRule({})).toBe(false);
  });
});

describe('alertWindow', () => {
  it('covers exactly 30 days ending at now, in whole seconds', () => {
    const { startTime, endTime } = alertWindow(
      new Date('2026-11-24T10:00:00.750Z'),
    );
    expect(endTime).toBe('2026-11-24T10:00:00.000Z');
    expect(startTime).toBe('2026-10-25T10:00:00.000Z');
  });
});

const alert = (severity: string) => ({ metadata: { alertRule: { severity } } });

describe('alertCounts', () => {
  it('counts fired and critical alerts', () => {
    expect(
      alertCounts({
        alerts: [alert('critical'), alert('warning'), alert('critical')],
        total: 3,
      }),
    ).toStrictEqual({ alertsFiredLast30Days: 3, criticalAlertsLast30Days: 2 });
  });

  it('leaves the critical count out when the items are truncated', () => {
    expect(
      alertCounts({ alerts: [alert('critical')], total: 1500 }),
    ).toStrictEqual({ alertsFiredLast30Days: 1500 });
  });

  it('leaves both out without a total', () => {
    expect(alertCounts({ alerts: [] })).toStrictEqual({});
  });
});

describe('incidentCounts', () => {
  it('counts open and unacknowledged incidents', () => {
    expect(
      incidentCounts({
        incidents: [
          { status: 'active' },
          { status: 'acknowledged' },
          { status: 'resolved' },
        ],
        total: 3,
      }),
    ).toStrictEqual({
      incidentsLast30Days: 3,
      openIncidentsLast30Days: 2,
      unacknowledgedIncidentsLast30Days: 1,
    });
  });

  it('leaves the status counts out when the items are truncated', () => {
    expect(
      incidentCounts({ incidents: [{ status: 'active' }], total: 2 }),
    ).toStrictEqual({ incidentsLast30Days: 2 });
  });
});

describe('environmentAlerts', () => {
  it('reports counts for an environment with an observer', () => {
    expect(
      environmentAlerts({
        environment: 'prod',
        isProduction: true,
        hasObservability: true,
        alerts: { alerts: [], total: 0 },
        incidents: { incidents: [], total: 0 },
      }),
    ).toStrictEqual({
      environment: 'prod',
      isProduction: true,
      hasObservability: true,
      alertsFiredLast30Days: 0,
      criticalAlertsLast30Days: 0,
      incidentsLast30Days: 0,
      openIncidentsLast30Days: 0,
      unacknowledgedIncidentsLast30Days: 0,
    });
  });

  it('leaves counts out without observability', () => {
    expect(
      environmentAlerts({
        environment: 'dev',
        isProduction: false,
        hasObservability: false,
        alerts: { alerts: [], total: 0 },
      }),
    ).toStrictEqual({
      environment: 'dev',
      isProduction: false,
      hasObservability: false,
    });
  });

  it('leaves out fields that are unknown', () => {
    expect(environmentAlerts({ environment: 'dev' })).toStrictEqual({
      environment: 'dev',
    });
  });

  it('keeps the counts of the query that answered', () => {
    expect(
      environmentAlerts({
        environment: 'prod',
        isProduction: true,
        hasObservability: true,
        incidents: { incidents: [{ status: 'active' }], total: 1 },
      }),
    ).toStrictEqual({
      environment: 'prod',
      isProduction: true,
      hasObservability: true,
      incidentsLast30Days: 1,
      openIncidentsLast30Days: 1,
      unacknowledgedIncidentsLast30Days: 1,
    });
  });
});

describe('alertCountsResolved', () => {
  const counted = (environment: string) => ({
    environment,
    hasObservability: true,
    alertsFiredLast30Days: 0,
    criticalAlertsLast30Days: 0,
    incidentsLast30Days: 0,
    openIncidentsLast30Days: 0,
    unacknowledgedIncidentsLast30Days: 0,
  });

  it('holds when every environment with observability has all its counts', () => {
    expect(alertCountsResolved([counted('dev'), counted('prod')])).toBe(true);
  });

  it("isn't blocked by an environment without observability", () => {
    expect(
      alertCountsResolved([
        { environment: 'dev', hasObservability: false },
        counted('prod'),
      ]),
    ).toBe(true);
  });

  it('fails when one environment misses one count', () => {
    const truncated: EnvironmentAlerts = counted('prod');
    delete truncated.criticalAlertsLast30Days;
    expect(alertCountsResolved([counted('dev'), truncated])).toBe(false);
  });

  it("fails when an environment's observability is unknown", () => {
    expect(alertCountsResolved([counted('dev'), { environment: 'prod' }])).toBe(
      false,
    );
  });

  it('fails when no environment has observability', () => {
    expect(
      alertCountsResolved([{ environment: 'dev', hasObservability: false }]),
    ).toBe(false);
    expect(alertCountsResolved([])).toBe(false);
  });
});
