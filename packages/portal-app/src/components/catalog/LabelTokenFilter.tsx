import { useEffect, useMemo, useState } from 'react';
import { Box } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef, useEntityList } from '@backstage/plugin-catalog-react';
import { Entity } from '@backstage/catalog-model';
import { labelDisplayName } from '@openchoreo/backstage-plugin-common';
import {
  TokenFilterBar,
  type FilterFieldDef,
  type FilterToken,
  type FilterValueOption,
  type FilterValuesRequest,
  type FilterValuesState,
} from '@openchoreo/backstage-plugin-react';

const FILTER_PREFIX = 'label_';
const filterKeyFor = (labelKey: string) => `${FILTER_PREFIX}${labelKey}`;

const useStyles = makeStyles({
  root: {
    flex: '0 1 420px',
    minWidth: 260,
    maxWidth: 460,
    '& .MuiOutlinedInput-root': {
      borderRadius: 8,
    },
  },
});

/** Catalog filter over one metadata label (`metadata.labels.<key>`). */
export class EntityLabelFilter {
  readonly values: string[];
  readonly labelKey: string;

  constructor(labelKey: string, values: string[]) {
    this.labelKey = labelKey;
    this.values = values;
  }

  getCatalogFilters() {
    return { [`metadata.labels.${this.labelKey}`]: this.values };
  }

  filterEntity(entity: Entity): boolean {
    const value = entity.metadata.labels?.[this.labelKey];
    return value !== undefined && this.values.includes(value);
  }

  toQueryValue() {
    return this.values;
  }
}

interface LabelVocabulary {
  /** Sorted user-facing label keys present on the current kind. */
  keys: string[];
  /** Sorted values (with counts) per key. */
  valuesByKey: Map<string, FilterValueOption[]>;
  loading: boolean;
}

/**
 * Aggregates every label key/value (+counts) for a kind from one non-paginated
 * `getEntities` call, so suggestions are complete regardless of table paging.
 */
function useLabelVocabulary(kind: string | undefined): LabelVocabulary {
  const catalogApi = useApi(catalogApiRef);
  const [vocab, setVocab] = useState<LabelVocabulary>({
    keys: [],
    valuesByKey: new Map(),
    loading: false,
  });

  useEffect(() => {
    if (!kind) {
      setVocab({ keys: [], valuesByKey: new Map(), loading: false });
      return undefined;
    }
    let cancelled = false;
    setVocab(prev => ({ ...prev, loading: true }));
    catalogApi
      .getEntities({ filter: { kind }, fields: ['metadata.labels'] })
      .then(response => {
        if (cancelled) return;
        const counts = new Map<string, Map<string, number>>();
        for (const entity of response.items) {
          const labels = entity.metadata?.labels ?? {};
          for (const [key, value] of Object.entries(labels)) {
            if (!value) continue;
            let byValue = counts.get(key);
            if (!byValue) {
              byValue = new Map();
              counts.set(key, byValue);
            }
            byValue.set(value, (byValue.get(value) ?? 0) + 1);
          }
        }
        const valuesByKey = new Map<string, FilterValueOption[]>();
        for (const [key, byValue] of counts) {
          valuesByKey.set(
            key,
            [...byValue.entries()]
              .map(([value, count]) => ({ value, count }))
              .sort((a, b) => a.value.localeCompare(b.value)),
          );
        }
        setVocab({
          keys: [...valuesByKey.keys()].sort(),
          valuesByKey,
          loading: false,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setVocab({ keys: [], valuesByKey: new Map(), loading: false });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [kind, catalogApi]);

  return vocab;
}

/** Token-style catalog filter: type a label key, then pick its values. */
export const LabelTokenFilter = () => {
  const classes = useStyles();
  const { filters, updateFilters } = useEntityList();
  const kind = filters.kind?.value;
  const vocab = useLabelVocabulary(kind);

  const activeFilters = filters as Record<string, EntityLabelFilter | undefined>;

  const fields = useMemo<FilterFieldDef[]>(
    () =>
      vocab.keys.map(key => ({
        path: key,
        description: labelDisplayName(key),
        pickable: true,
      })),
    [vocab.keys],
  );

  // Applied filters → one chip per selected value.
  const tokens = useMemo<FilterToken[]>(() => {
    const result: FilterToken[] = [];
    for (const key of Object.keys(activeFilters)) {
      if (!key.startsWith(FILTER_PREFIX)) continue;
      const filter = activeFilters[key];
      if (!filter) continue;
      for (const value of filter.values) {
        result.push({ path: filter.labelKey, value });
      }
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Hide when this kind has no labels.
  if (!vocab.loading && vocab.keys.length === 0) {
    return null;
  }

  const valuesFor = (labelKey: string): string[] =>
    activeFilters[filterKeyFor(labelKey)]?.values ?? [];

  const setValues = (labelKey: string, values: string[]) => {
    updateFilters({
      [filterKeyFor(labelKey)]: values.length
        ? new EntityLabelFilter(labelKey, values)
        : undefined,
    } as any);
  };

  const onToggleToken = (path: string | null, value: string) => {
    if (!path) return;
    const current = valuesFor(path);
    setValues(
      path,
      current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value],
    );
  };

  const onRemoveToken = (path: string | null, value: string) => {
    if (!path) return;
    setValues(
      path,
      valuesFor(path).filter(v => v !== value),
    );
  };

  const onClear = () => {
    const cleared: Record<string, undefined> = {};
    for (const key of Object.keys(activeFilters)) {
      if (key.startsWith(FILTER_PREFIX)) cleared[key] = undefined;
    }
    updateFilters(cleared as any);
  };

  const useValues = ({
    path,
    query,
  }: FilterValuesRequest): FilterValuesState => {
    if (!path) return { values: [], loading: vocab.loading };
    const all = vocab.valuesByKey.get(path) ?? [];
    const needle = query.trim().toLowerCase();
    const values = needle
      ? all.filter(v => v.value.toLowerCase().includes(needle))
      : all;
    return { values, totalValues: all.length, loading: vocab.loading };
  };

  return (
    <Box className={classes.root}>
      <TokenFilterBar
        tokens={tokens}
        fields={fields}
        onToggleToken={onToggleToken}
        onRemoveToken={onRemoveToken}
        onClear={onClear}
        useValues={useValues}
        allowFreeText={false}
        showHint={false}
        showFieldDescription={false}
        fieldsHeader="Labels you can filter on"
        emptyPlaceholder="Filter by label"
        placeholder="Filter by label"
        ariaLabel="Filter by label"
      />
    </Box>
  );
};
