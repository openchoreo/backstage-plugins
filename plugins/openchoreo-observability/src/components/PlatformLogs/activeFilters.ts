import { PLATFORM_LOG_LEVELS, PlatformLogsFilters } from './types';

/** One summarised filter, ready to render as a chip. */
export interface ActiveFilter {
  /** Stable key, also the field cleared when the chip is dismissed. */
  id: keyof PlatformLogsFilters;
  label: string;
  /** The value to clear this filter back to. */
  cleared: Partial<PlatformLogsFilters>;
}

/** Truncates a long single value so one chip cannot take the whole row. */
function short(value: string, max = 28): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/**
 * Summarises a list filter as one chip: the value itself when there is exactly one,
 * a count when there are several.
 *
 * One chip per filter rather than per value is the whole point. Selecting six pods
 * would otherwise push six chips onto the row and wrap it to three lines - the chip
 * row has to stay a fixed-height summary, or it becomes another thing pushing the
 * logs down the page.
 */
function listFilter(
  id: keyof PlatformLogsFilters,
  noun: string,
  values: string[],
): ActiveFilter | null {
  if (values.length === 0) return null;
  return {
    id,
    label:
      values.length === 1
        ? `${noun}: ${short(values[0])}`
        : `${noun}: ${values.length}`,
    cleared: { [id]: [] } as Partial<PlatformLogsFilters>,
  };
}

/**
 * The filters currently narrowing the query, as chips.
 *
 * Everything that changes the result set is included - scope as well as labels and
 * levels. Scope is the main way this page is filtered, so leaving it out of the summary
 * would mean the collapsed toolbar could hide the most consequential thing applied.
 *
 * Excluded on purpose: the observability plane (a data source, not a filter, and always
 * set), the time range (always set, and shown in the toolbar), sort order and columns
 * (display, not filtering), and the search phrase (its own always-visible box).
 */
export function activeFilters(filters: PlatformLogsFilters): ActiveFilter[] {
  const chips: Array<ActiveFilter | null> = [
    listFilter('clusterInstances', 'Cluster', filters.clusterInstances),
    listFilter('namespaces', 'Namespace', filters.namespaces),
    listFilter('podNames', 'Pod', filters.podNames),
    listFilter('containerNames', 'Container', filters.containerNames),
    filters.labels
      ? {
          id: 'labels' as const,
          label: `Labels: ${short(filters.labels)}`,
          cleared: { labels: '' },
        }
      : null,
    // All levels selected is the same query as no level filter, so it is not "active".
    // None selected very much is: it matches nothing, and the query is not even sent.
    // Leaving it off the row would explain an empty table with no chip to clear.
    filters.logLevel.length < PLATFORM_LOG_LEVELS.length
      ? {
          id: 'logLevel' as const,
          label:
            filters.logLevel.length === 0
              ? 'Level: none'
              : `Level: ${filters.logLevel.join(', ')}`,
          cleared: { logLevel: [...PLATFORM_LOG_LEVELS] },
        }
      : null,
  ];

  return chips.filter((chip): chip is ActiveFilter => chip !== null);
}

/** Resets every filter the chips can represent, in one update. */
export function clearedFilters(): Partial<PlatformLogsFilters> {
  return {
    clusterInstances: [],
    namespaces: [],
    podNames: [],
    containerNames: [],
    labels: '',
    logLevel: [...PLATFORM_LOG_LEVELS],
  };
}
