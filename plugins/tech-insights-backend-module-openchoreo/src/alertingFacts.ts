/** A trait instance as a Component, ReleaseLine or component type lists it. */
export interface TraitReference {
  kind?: string;
  name: string;
  instanceName?: string;
}

/** A trait instance with its CRD default kind filled in. */
export interface TraitInstance {
  kind: 'Trait' | 'ClusterTrait';
  name: string;
}

/** The subset of a Trait or ClusterTrait spec read here. */
export interface TraitSpec {
  creates?: { template?: unknown }[];
}

/** The longest window the observer accepts, and the window the counts cover. */
export const ALERT_WINDOW_DAYS = 30;

/** The observer's largest page. It has no cursor, so this is all a query sees. */
export const OBSERVER_QUERY_LIMIT = 1000;

function traitKind(
  kind: string | undefined,
  defaultKind: TraitInstance['kind'],
) {
  return (kind || defaultKind) as TraitInstance['kind'];
}

/**
 * The trait instances a line renders: the Component's, the ones its type
 * embeds, and for a release line those of the line's traits that match no
 * Component trait or earlier line trait on kind, name and instance name. A
 * line trait that matches one is deep-merged into it, so it is the same
 * instance, and a line can't remove traits (`EffectiveComponent` in OpenChoreo's
 * internal/releaseline/component.go). Embedded traits default to ClusterTrait
 * in a ClusterComponentType.
 */
export function configuredTraits(input: {
  componentTraits?: TraitReference[];
  typeTraits?: TraitReference[];
  clusterScopedType?: boolean;
  lineTraits?: TraitReference[];
}): TraitInstance[] {
  const componentTraits = input.componentTraits ?? [];
  const key = (trait: TraitReference) =>
    `${traitKind(trait.kind, 'Trait')}/${trait.name}/${
      trait.instanceName ?? ''
    }`;
  const effectiveKeys = new Set(componentTraits.map(key));
  const typeDefault = input.clusterScopedType ? 'ClusterTrait' : 'Trait';
  return [
    ...componentTraits.map(trait => ({
      kind: traitKind(trait.kind, 'Trait'),
      name: trait.name,
    })),
    ...(input.typeTraits ?? []).map(trait => ({
      kind: traitKind(trait.kind, typeDefault),
      name: trait.name,
    })),
    ...(input.lineTraits ?? [])
      .filter(trait => {
        const traitKey = key(trait);
        if (effectiveKeys.has(traitKey)) {
          return false;
        }
        effectiveKeys.add(traitKey);
        return true;
      })
      .map(trait => ({
        kind: traitKind(trait.kind, 'Trait'),
        name: trait.name,
      })),
  ];
}

/**
 * Whether a trait creates an ObservabilityAlertRule. Matched on a literal
 * `template.kind`, so a kind written as a CEL expression isn't recognised.
 */
export function createsAlertRule(spec: TraitSpec): boolean {
  return (spec.creates ?? []).some(
    create =>
      (create.template as { kind?: unknown } | undefined)?.kind ===
      'ObservabilityAlertRule',
  );
}

/**
 * The trailing window ending at `now`, in whole seconds: the observer drops
 * sub-seconds when it checks the window against its 30-day limit.
 */
export function alertWindow(now: Date): { startTime: string; endTime: string } {
  const end = Math.floor(now.getTime() / 1000) * 1000;
  const start = end - ALERT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return {
    startTime: new Date(start).toISOString(),
    endTime: new Date(end).toISOString(),
  };
}

/** The subset of an observer alerts query response read here. */
export interface AlertsResult {
  alerts?: { metadata?: { alertRule?: { severity?: string } } }[];
  total?: number;
}

const INCIDENT_STATUSES = ['active', 'acknowledged', 'resolved'];

/** The subset of an observer incidents query response read here. */
export interface IncidentsResult {
  incidents?: { status?: string }[];
  total?: number;
}

/**
 * The observer counts the total in a separate query before it selects the
 * page, so a page whose length differs from the total is a mismatched
 * snapshot, and a full page may be truncated.
 */
function isComplete(items: unknown[], total: number) {
  return items.length === total && items.length < OBSERVER_QUERY_LIMIT;
}

/**
 * Counts over one alerts query. Counts read from the items are left out when
 * the response holds 1000 items (the observer's cap) or a number of items
 * other than its total.
 */
export function alertCounts(result: AlertsResult) {
  const { total } = result;
  if (typeof total !== 'number') {
    return {};
  }
  const alerts = result.alerts ?? [];
  return {
    alertsFiredLast30Days: total,
    ...(isComplete(alerts, total) && {
      criticalAlertsLast30Days: alerts.filter(
        alert => alert.metadata?.alertRule?.severity === 'critical',
      ).length,
    }),
  };
}

/**
 * Counts over one incidents query. An incident is open while it is active
 * or acknowledged, and unacknowledged while it is active. Counts read from
 * the items are left out when the response holds 1000 items (the observer's
 * cap) or a number of items other than its total, and when an incident has no
 * recognized status.
 */
export function incidentCounts(result: IncidentsResult) {
  const { total } = result;
  if (typeof total !== 'number') {
    return {};
  }
  const incidents = result.incidents ?? [];
  const withStatus = (...statuses: string[]) =>
    incidents.filter(incident => statuses.includes(incident.status ?? ''))
      .length;
  const statusesKnown = incidents.every(incident =>
    INCIDENT_STATUSES.includes(incident.status ?? ''),
  );
  return {
    incidentsLast30Days: total,
    ...(isComplete(incidents, total) &&
      statusesKnown && {
        openIncidentsLast30Days: withStatus('active', 'acknowledged'),
        unacknowledgedIncidentsLast30Days: withStatus('active'),
      }),
  };
}

/** One entry of `openchoreoEnvironmentAlerts`. */
export type EnvironmentAlerts = {
  environment: string;
  isProduction?: boolean;
  hasObservability?: boolean;
  alertsFiredLast30Days?: number;
  criticalAlertsLast30Days?: number;
  incidentsLast30Days?: number;
  openIncidentsLast30Days?: number;
  unacknowledgedIncidentsLast30Days?: number;
};

/**
 * An environment's entry. Fields that are unknown are left out rather than
 * set, and counts appear only for an environment with an observer.
 */
export function environmentAlerts(input: {
  environment: string;
  isProduction?: boolean;
  hasObservability?: boolean;
  alerts?: AlertsResult;
  incidents?: IncidentsResult;
}): EnvironmentAlerts {
  return {
    environment: input.environment,
    ...(input.isProduction !== undefined && {
      isProduction: input.isProduction,
    }),
    ...(input.hasObservability !== undefined && {
      hasObservability: input.hasObservability,
    }),
    ...(input.hasObservability && input.alerts && alertCounts(input.alerts)),
    ...(input.hasObservability &&
      input.incidents &&
      incidentCounts(input.incidents)),
  };
}

const COUNT_FIELDS: (keyof EnvironmentAlerts)[] = [
  'alertsFiredLast30Days',
  'criticalAlertsLast30Days',
  'incidentsLast30Days',
  'openIncidentsLast30Days',
  'unacknowledgedIncidentsLast30Days',
];

/**
 * Whether the entries hold every count they could: at least one environment
 * has observability, each of those has all its counts, and none has an
 * unknown `hasObservability`.
 */
export function alertCountsResolved(entries: EnvironmentAlerts[]): boolean {
  if (entries.some(entry => entry.hasObservability === undefined)) {
    return false;
  }
  const observed = entries.filter(entry => entry.hasObservability);
  return (
    observed.length > 0 &&
    observed.every(entry =>
      COUNT_FIELDS.every(field => typeof entry[field] === 'number'),
    )
  );
}
