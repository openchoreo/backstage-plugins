import { useMemo, useRef, type ReactNode } from 'react';
import { jsonLanguage } from '@codemirror/lang-json';
import { linter } from '@codemirror/lint';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import useLatest from 'react-use/lib/useLatest';
import { JsonEditor } from './JsonEditor';
import {
  filterCompletionSource,
  type FilterSuggestions,
} from './filterCompletions';
import { filterShapeLinter, optionalJsonParseLinter } from './filterLint';

const LINT_DELAY_MS = 300;

/** Entities read to learn which annotation keys exist. */
const ANNOTATION_SAMPLE_SIZE = 500;

export interface FilterEditorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** The kinds the check targets; suggestions come from these entities. */
  kinds: string[];
  /**
   * A filter the kind picker can't show, edited whole: it may be an array
   * and may name its kinds.
   */
  raw: boolean;
  placeholder?: string;
  error?: boolean;
  helperText?: ReactNode;
}

/**
 * The check's entity filter as JSON: syntax errors, a mark on a `kind` key
 * the picker should hold, and suggestions for entity paths and the values
 * the catalog has for them.
 */
export function FilterEditor(props: FilterEditorProps) {
  const { kinds, raw, ...editorProps } = props;
  const catalogApi = useApi(catalogApiRef);

  // Answers are kept per kinds and key for the life of the form, and a
  // failed lookup suggests nothing rather than breaking the editor.
  const cache = useRef(new Map<string, Promise<string[]>>());
  const kindsKey = [...kinds].sort().join('\n');
  const suggestions = useMemo<FilterSuggestions>(() => {
    const filter = kinds.length > 0 ? { kind: kinds } : undefined;
    const cached = (key: string, load: () => Promise<string[]>) => {
      const id = `${kindsKey}|${key}`;
      let entry = cache.current.get(id);
      if (!entry) {
        entry = load().catch(() => {
          cache.current.delete(id);
          return [];
        });
        cache.current.set(id, entry);
      }
      return entry;
    };
    return {
      annotationKeys: () =>
        cached('annotations', async () => {
          const { items } = await catalogApi.queryEntities({
            filter,
            fields: ['metadata.annotations'],
            limit: ANNOTATION_SAMPLE_SIZE,
          });
          const keys = new Set(
            items.flatMap(item => Object.keys(item.metadata.annotations ?? {})),
          );
          return [...keys].sort();
        }),
      valuesOf: facetKey =>
        cached(`facet:${facetKey}`, async () => {
          const { facets } = await catalogApi.getEntityFacets({
            facets: [facetKey],
            filter,
          });
          return (facets[facetKey] ?? []).map(facet => facet.value);
        }),
    };
    // kindsKey stands for kinds, so a new array with the same kinds is no change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogApi, kindsKey]);

  const suggestionsRef = useLatest(suggestions);
  const extensions = useMemo(
    () => [
      linter(optionalJsonParseLinter, { delay: LINT_DELAY_MS }),
      linter(filterShapeLinter(raw), { delay: LINT_DELAY_MS }),
      jsonLanguage.data.of({
        autocomplete: filterCompletionSource(() => suggestionsRef.current),
      }),
    ],
    [raw, suggestionsRef],
  );

  return (
    <JsonEditor
      {...editorProps}
      extensions={extensions}
      expandable={false}
      minHeight={raw ? '8rem' : '4.5rem'}
    />
  );
}
