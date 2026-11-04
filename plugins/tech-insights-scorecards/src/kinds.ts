import { useMemo } from 'react';
import useAsync from 'react-use/lib/useAsync';
import { configApiRef, useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';

/** `DeploymentPipeline` becomes "Deployment pipeline"; `API` stays "API". */
export function humanizeKind(kind: string): string {
  const words = kind
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(' ');
  return words
    .map((word, index) =>
      index === 0 || word === word.toUpperCase()
        ? word
        : word.toLocaleLowerCase('en-US'),
    )
    .join(' ');
}

/** A kind label for use inside a sentence: "this namespace", "this API". */
export function inSentence(label: string): string {
  const [first] = label.split(' ');
  return first === first.toUpperCase() && first.length > 1
    ? label
    : label.charAt(0).toLocaleLowerCase('en-US') + label.slice(1);
}

/** "Component" becomes "Components", "Policy" "Policies", "API" "APIs". */
export function pluralOf(label: string): string {
  if (/[^aeiou]y$/i.test(label)) return `${label.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/i.test(label)) return `${label}es`;
  return `${label}s`;
}

/** "1 component", "4 component types". */
export function countOf(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** "a resource", "an entity". */
export function withArticle(word: string): string {
  return `${/^[aeiou]/i.test(word) ? 'an' : 'a'} ${word}`;
}

/** "resource" becomes "Resource", for the start of a label. */
export function capitalized(word: string): string {
  return word.charAt(0).toLocaleUpperCase('en-US') + word.slice(1);
}

const MINOR_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'but',
  'by',
  'for',
  'in',
  'nor',
  'of',
  'on',
  'or',
  'the',
  'to',
]);

/**
 * Headline case for a column title, "Cluster Component Types Passing":
 * every word capitalized except articles, conjunctions and short
 * prepositions, unless one comes first.
 */
export function titleCase(text: string): string {
  return text
    .split(' ')
    .map((word, index) =>
      index > 0 && MINOR_WORDS.has(word.toLocaleLowerCase('en-US'))
        ? word.toLocaleLowerCase('en-US')
        : capitalized(word),
    )
    .join(' ');
}

export interface EntityLabel {
  singular: string;
  plural: string;
}

/**
 * The word for what checks run against, in text that covers several kinds,
 * from `techInsights.scorecards.entityLabel`. Text about one kind names the
 * kind instead (see `useKindLabel`).
 */
export function useEntityLabel(): EntityLabel {
  const config = useApi(configApiRef);
  return useMemo(() => {
    const singular =
      config.getOptionalString(
        'techInsights.scorecards.entityLabel.singular',
      ) ?? 'entity';
    const plural =
      config.getOptionalString('techInsights.scorecards.entityLabel.plural') ??
      (singular === 'entity' ? 'entities' : pluralOf(singular));
    return { singular, plural };
  }, [config]);
}

/**
 * The name to show for an entity kind, from
 * `techInsights.scorecards.kindLabels` (matched case-insensitively), else
 * the kind split into words.
 */
export function useKindLabel(): (kind: string) => string {
  const config = useApi(configApiRef);
  return useMemo(() => {
    const labels = new Map<string, string>();
    const configured = config.getOptionalConfig(
      'techInsights.scorecards.kindLabels',
    );
    configured?.keys().forEach(key => {
      labels.set(key.toLocaleLowerCase('en-US'), configured.getString(key));
    });
    return (kind: string) =>
      labels.get(kind.toLocaleLowerCase('en-US')) ?? humanizeKind(kind);
  }, [config]);
}

/** The kinds in the catalog, as the catalog spells them, sorted. */
export function useCatalogKinds(): string[] | undefined {
  const catalogApi = useApi(catalogApiRef);
  const { value } = useAsync(async () => {
    const { facets } = await catalogApi.getEntityFacets({ facets: ['kind'] });
    return (facets.kind ?? []).map(f => f.value).sort();
  }, [catalogApi]);
  return value;
}

/**
 * `kind` in the catalog's own spelling when the catalog has it, matched
 * case-insensitively. Filters match kinds without regard to case, so a
 * filter's `component` is the catalog's `Component`.
 */
export function canonicalKind(kind: string, catalogKinds: string[] = []) {
  const lower = kind.toLocaleLowerCase('en-US');
  return catalogKinds.find(k => k.toLocaleLowerCase('en-US') === lower) ?? kind;
}

/**
 * The label for a kind written in any case, such as one from a filter: its
 * catalog spelling, then its configured or humanized label.
 */
export function useKindDisplay(): (kind: string) => string {
  const kindLabel = useKindLabel();
  const catalogKinds = useCatalogKinds();
  return useMemo(
    () => (kind: string) => kindLabel(canonicalKind(kind, catalogKinds)),
    [kindLabel, catalogKinds],
  );
}

/** Whether a filter key names the kind, in any case, as `Kind` or `KIND`. */
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
 */
export function filterCoversKinds(filter: unknown, kinds: string[]): boolean {
  const covered = kindsOfFilter(filter);
  if (kinds.length === 0 || covered === 'all') return true;
  const coveredLower = covered.map(kind => kind.toLocaleLowerCase('en-US'));
  return kinds.some(kind =>
    coveredLower.includes(kind.toLocaleLowerCase('en-US')),
  );
}
