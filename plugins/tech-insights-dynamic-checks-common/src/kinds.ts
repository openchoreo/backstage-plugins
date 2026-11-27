/**
 * Whether a filter key names the kind, in any case, as `Kind` or `KIND`.
 *
 * @public
 */
export function isKindKey(key: string): boolean {
  return key.toLocaleLowerCase('en-US') === 'kind';
}

/**
 * The kinds an entity filter matches, spelled as the filter first writes
 * each, or `'all'` when there is no filter or a filter object without a kind.
 * This is the shape of a check's `filter` and a fact retriever's
 * `entityFilter`: one object or an array of them, any of which may match, and
 * its kind a string or an array, matched without regard to case, as jsonfc
 * does. The spelling is kept for display, since a lowercased `componenttype`
 * can't be split back into words when the catalog has no entity of that kind.
 *
 * @public
 */
export function kindsOfFilter(filter: unknown): string[] | 'all' {
  const filters =
    filter === undefined || filter === null ? [] : [filter].flat();
  if (filters.length === 0) return 'all';
  const kinds = new Map<string, string>();
  for (const entry of filters) {
    if (typeof entry !== 'object' || entry === null) return 'all';
    const record = entry as Record<string, unknown>;
    const key = Object.keys(record).find(isKindKey);
    const values = key ? [record[key]].flat() : [];
    const named = values.filter((v): v is string => typeof v === 'string');
    if (named.length === 0) return 'all';
    named.forEach(v => {
      const lower = v.toLocaleLowerCase('en-US');
      if (!kinds.has(lower)) kinds.set(lower, v);
    });
  }
  return Array.from(kinds.values()).sort();
}

/**
 * Whether a filter matches at least one of `kinds`. With no kinds there is
 * nothing to narrow by, so every filter covers them.
 *
 * @public
 */
export function filterCoversKinds(filter: unknown, kinds: string[]): boolean {
  const covered = kindsOfFilter(filter);
  if (kinds.length === 0 || covered === 'all') return true;
  const coveredLower = covered.map(kind => kind.toLocaleLowerCase('en-US'));
  return kinds.some(kind =>
    coveredLower.includes(kind.toLocaleLowerCase('en-US')),
  );
}
