import {
  TokenFilterBar,
  buildPathAliases,
  parseFilterDraft,
  resolvePath,
  type FilterFieldDef,
  type FilterValuesRequest,
  type FilterValuesState,
} from '@openchoreo/backstage-plugin-react';
import {
  AUDIT_FILTER_DESCRIPTIONS,
  AUDIT_FILTER_PATHS,
  AuditFilterPath,
  AuditPickableFilter,
  AuditQueryToken,
  isPickableFilter,
  isSupportedFilterValue,
} from './types';
import { AuditWindow } from './query';
import { useAuditFilterValues } from '../../hooks/useAuditFilterValues';

export interface AuditQueryBarProps {
  tokens: AuditQueryToken[];
  window: AuditWindow;
  onToggleToken: (path: AuditFilterPath | null, value: string) => void;
  onRemoveToken: (path: AuditFilterPath | null, value: string) => void;
  onClear: () => void;
  disabled?: boolean;
}

const AUDIT_PATHS: string[] = [...AUDIT_FILTER_PATHS];

const AUDIT_ALIASES = buildPathAliases(AUDIT_PATHS);

/** The audit vocabulary, named as the query body names it. */
const AUDIT_FIELDS: FilterFieldDef[] = AUDIT_FILTER_PATHS.map(path => ({
  path,
  description: AUDIT_FILTER_DESCRIPTIONS[path],
  pickable: isPickableFilter(path),
}));

export function resolveFilterPath(key: string): AuditFilterPath | null {
  return resolvePath(key, AUDIT_PATHS, AUDIT_ALIASES) as AuditFilterPath | null;
}

/** Splits `actor.id:ali` into the field and the text typed against it. */
export function parseDraft(draft: string): {
  path: AuditFilterPath | null;
  query: string;
} {
  return parseFilterDraft(draft, AUDIT_PATHS, AUDIT_ALIASES) as {
    path: AuditFilterPath | null;
    query: string;
  };
}

/**
 * The audit trail's query bar: the shared {@link TokenFilterBar} bound to the
 * filter set the audit API accepts and to the observer's own value counts.
 *
 * Nothing here is audit-specific beyond the vocabulary and where values come
 * from, which is the whole point of the split — component and platform logs
 * can adopt the same bar by supplying their own two.
 */
export const AuditQueryBar = ({
  tokens,
  window: auditWindow,
  onToggleToken,
  onRemoveToken,
  onClear,
  disabled = false,
}: AuditQueryBarProps) => {
  // Declared per render rather than memoised: the bar calls it during its own
  // render, so it is a hook, and a stale window or token list would ask the
  // observer about the wrong query.
  const useValues = ({
    path,
    query,
    enabled,
  }: FilterValuesRequest): FilterValuesState => {
    const auditPath = path as AuditFilterPath | null;
    const pickable = auditPath !== null && isPickableFilter(auditPath);

    const result = useAuditFilterValues({
      window: auditWindow,
      tokens,
      // A hook cannot be called conditionally, so an unpickable field parks on
      // a cheap filter name with the query disabled; nothing is requested.
      filter: (pickable ? auditPath : 'result') as AuditPickableFilter,
      valueSearch: query || undefined,
      enabled: enabled && pickable,
    });

    // The aggregation reports what the trail holds, which on a closed filter
    // can include a value the request body has no room for.
    const values =
      auditPath === null
        ? result.values
        : result.values.filter(value =>
            isSupportedFilterValue(auditPath, value.value),
          );

    return {
      values,
      totalValues: result.totalValues,
      loading: result.loading,
      // The cache is shared with the outcome tiles, which keep `result` warm,
      // and `keepPreviousData` holds the previous field's list across a switch
      // — so the bar is told whenever the list is not this field's.
      stale: pickable && result.resolvedFilter !== path,
      unsupported: result.unsupported,
    };
  };

  return (
    <TokenFilterBar
      tokens={tokens}
      fields={AUDIT_FIELDS}
      onToggleToken={(path, value) =>
        onToggleToken(path as AuditFilterPath | null, value)
      }
      onRemoveToken={(path, value) =>
        onRemoveToken(path as AuditFilterPath | null, value)
      }
      onClear={onClear}
      useValues={useValues}
      isValueAllowed={(path, value) =>
        isSupportedFilterValue(path as AuditFilterPath, value)
      }
      label="Filters"
      exampleFields="actor, action, result, namespace"
      freeTextNote="sent as searchPhrase"
      emptyPlaceholder="Filter records, e.g. result:denied"
      ariaLabel="Filter audit records"
      valuesFootnote="Counts come from the observer and can be approximate on a field with many values. Read them as a rough scale, not a finding."
      disabled={disabled}
    />
  );
};
