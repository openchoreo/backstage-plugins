/** One applied filter. A `null` path is free text rather than a field. */
export interface FilterToken {
  path: string | null;
  value: string;
}

/** A field the bar offers, named as the query sends it. */
export interface FilterFieldDef {
  path: string;
  description: string;
  /**
   * Whether the field has a value list worth offering. A near-unique field —
   * an id, a request correlator — has none, and says so instead.
   */
  pickable?: boolean;
}

export interface FilterValueOption {
  value: string;
  /** How many records carry it, when the source counts. */
  count?: number;
}

/** What a value provider reports back for the field the bar is asking about. */
export interface FilterValuesState {
  values: FilterValueOption[];
  /** Matching values in total, which may exceed what was returned. */
  totalValues?: number;
  loading?: boolean;
  /**
   * True while the values in hand belong to a different field than the one
   * asked for — a shared cache or a kept-previous list mid-switch. The bar
   * shows "looking" rather than another field's values as this one's.
   */
  stale?: boolean;
  /** The source cannot list values for this field at all. */
  unsupported?: boolean;
}

export interface FilterValuesRequest {
  /** The field to list, or null while the user is still naming one. */
  path: string | null;
  /** What has been typed against the field, debounced by the bar. */
  query: string;
  /** Whether a list is wanted at all — false keeps the provider idle. */
  enabled: boolean;
}

/**
 * Supplies the values a field takes. A hook so the provider can query on its
 * own terms; it is called unconditionally on every render, so it must obey the
 * rules of hooks.
 *
 * The reference may change between renders — declaring it inline is fine — but
 * the hooks it calls must not: passing a provider on one render and omitting it
 * on the next changes the hook order and will throw.
 */
export type FilterValuesProvider = (
  request: FilterValuesRequest,
) => FilterValuesState;
