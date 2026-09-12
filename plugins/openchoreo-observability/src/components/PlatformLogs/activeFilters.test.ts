import { activeFilters, clearedFilters } from './activeFilters';
import {
  DEFAULT_PLATFORM_LOG_FIELDS,
  PLATFORM_LOG_LEVELS,
  PlatformLogsFilters,
} from './types';

const base = (
  over: Partial<PlatformLogsFilters> = {},
): PlatformLogsFilters => ({
  observabilityPlane: 'default',
  selectedFields: DEFAULT_PLATFORM_LOG_FIELDS,
  clusterInstances: [],
  namespaces: [],
  podNames: [],
  containerNames: [],
  labels: '',
  logLevel: [...PLATFORM_LOG_LEVELS],
  timeRange: '10m',
  sortOrder: 'desc',
  ...over,
});

describe('activeFilters', () => {
  it('is empty when nothing narrows the query', () => {
    expect(activeFilters(base())).toEqual([]);
  });

  it('names the value when a filter has exactly one', () => {
    const [chip] = activeFilters(base({ namespaces: ['thunder'] }));

    expect(chip.label).toBe('Namespace: thunder');
  });

  // The reason chips are per filter and not per value: six selected pods must not push
  // six chips onto the row and wrap it to three lines.
  it('counts instead of listing when a filter has several values', () => {
    const [chip] = activeFilters(
      base({ podNames: ['a', 'b', 'c', 'd', 'e', 'f'] }),
    );

    expect(chip.label).toBe('Pod: 6');
  });

  it('summarises every kind of filter, scope included', () => {
    const chips = activeFilters(
      base({
        clusterInstances: ['cluster1'],
        namespaces: ['thunder'],
        podNames: ['p1'],
        containerNames: ['c1'],
        labels: 'openchoreo.dev/plane=controlplane',
        logLevel: ['ERROR'],
      }),
    );

    expect(chips.map(c => c.id)).toEqual([
      'clusterInstances',
      'namespaces',
      'podNames',
      'containerNames',
      'labels',
      'logLevel',
    ]);
  });

  // All levels selected produces the same query as no level filter at all, so showing
  // it as "active" would be a chip the user cannot meaningfully remove.
  it('does not count all log levels as a filter', () => {
    expect(activeFilters(base({ logLevel: [...PLATFORM_LOG_LEVELS] }))).toEqual(
      [],
    );
    expect(activeFilters(base({ logLevel: ['ERROR'] }))).toHaveLength(1);
  });

  // Selecting no level matches nothing and the query is not even sent. Left off the
  // row, an empty table would come with no explanation and no chip to clear.
  it('counts an empty level selection as a filter', () => {
    const chips = activeFilters(base({ logLevel: [] }));

    expect(chips).toHaveLength(1);
    expect(chips[0].id).toBe('logLevel');
    expect(chips[0].label).toBe('Level: none');
    expect(chips[0].cleared).toEqual({ logLevel: PLATFORM_LOG_LEVELS });
  });

  it('truncates a long single value so one chip cannot take the row', () => {
    const [chip] = activeFilters(
      base({ labels: 'openchoreo.dev/plane=controlplane,tier=infrastructure' }),
    );

    expect(chip.label.length).toBeLessThanOrEqual('Labels: '.length + 28);
    expect(chip.label.endsWith('…')).toBe(true);
  });

  it('clears the filter it represents, and only that one', () => {
    const chips = activeFilters(
      base({ namespaces: ['thunder'], podNames: ['p1'] }),
    );
    const namespaceChip = chips.find(c => c.id === 'namespaces')!;

    expect(namespaceChip.cleared).toEqual({ namespaces: [] });
  });

  it('restores all levels rather than none when the level chip is dismissed', () => {
    const [chip] = activeFilters(base({ logLevel: ['ERROR'] }));

    // Clearing to [] would mean "no levels selected", which fetches nothing.
    expect(chip.cleared).toEqual({ logLevel: PLATFORM_LOG_LEVELS });
  });
});

describe('clearedFilters', () => {
  it('resets everything the chips can represent', () => {
    const reset = { ...base(), ...clearedFilters() };

    expect(activeFilters(reset)).toEqual([]);
  });

  it('leaves the data source and display settings alone', () => {
    const reset = clearedFilters();

    expect(reset).not.toHaveProperty('observabilityPlane');
    expect(reset).not.toHaveProperty('timeRange');
    expect(reset).not.toHaveProperty('selectedFields');
    expect(reset).not.toHaveProperty('sortOrder');
  });
});
