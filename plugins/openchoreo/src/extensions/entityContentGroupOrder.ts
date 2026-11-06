// Tab-group order for the flat tab bar. Tabs whose `group` is missing here
// fall to the end in registration order.
//
// `development` is upstream's group for the api-docs "APIs" tab. It ranks
// after `deploy` because Build and Deploy are the main workflow tabs and the
// APIs tab only shows on components that provide or consume an API — ahead of
// them it would sit between Definition and Build on some components and not
// others, shifting Build and Deploy from one component to the next.
const GROUP_ORDER = [
  'overview',
  'documentation',
  'definition',
  'api-try-out',
  'build',
  'deploy',
  'development',
  'cell-diagram',
  'diagram',
  'logs',
  'events',
  'metrics',
  'alerts',
  'wirelogs',
  'traces',
  'incidents',
  'rca-reports',
  'cost-analysis',
  'deployment',
  'operation',
  'observability',
  'external',
] as const;

const groupPriority = (group: string) => {
  const i = (GROUP_ORDER as readonly string[]).indexOf(group);
  return i === -1 ? GROUP_ORDER.length : i;
};

/**
 * Orders entity-page tabs by their group, tie-breaking on registration order
 * so tabs sharing a group keep the order their extensions contributed them in.
 */
export function sortByGroupOrder<T>(
  items: T[],
  groupOf: (item: T) => string,
): T[] {
  return items
    .map((item, registrationIndex) => ({ item, registrationIndex }))
    .sort(
      (a, b) =>
        groupPriority(groupOf(a.item)) - groupPriority(groupOf(b.item)) ||
        a.registrationIndex - b.registrationIndex,
    )
    .map(d => d.item);
}
