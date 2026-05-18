import type {
  ActionCapability,
  CapabilityResource,
  UserCapabilitiesResponse,
} from '@openchoreo/backstage-plugin-common';

/**
 * Resolves the capability entry for a given action, falling back through
 * resource-class wildcards.
 *
 * Lookup order for action="releasebinding:create":
 *   1. caps["releasebinding:create"]   (exact match)
 *   2. caps["releasebinding:*"]        (resource-class wildcard)
 *   3. caps["*"]                       (global wildcard)
 *
 * When more than one key matches, the resulting `allowed` and `denied` arrays
 * are merged. Constraints on individual entries are preserved — duplicates are
 * removed only when path AND constraint expression set are identical, otherwise
 * the entries coexist (an unconstrained allow can render an action enabled even
 * when a wildcard-keyed constrained allow exists alongside it).
 *
 * Returns `undefined` only when none of the three keys are present.
 */
export function resolveCapability(
  capabilities: UserCapabilitiesResponse['capabilities'] | undefined,
  action: string,
): ActionCapability | undefined {
  if (!capabilities) return undefined;

  const [resourceClass] = action.split(':');
  const resourceWildcard = resourceClass ? `${resourceClass}:*` : undefined;

  const entries: ActionCapability[] = [];
  const seen = new Set<string>();
  for (const key of [action, resourceWildcard, '*'] as (string | undefined)[]) {
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const cap = capabilities[key];
    if (cap) entries.push(cap);
  }

  if (entries.length === 0) return undefined;
  if (entries.length === 1) return entries[0];

  return {
    allowed: mergeEntries(entries.flatMap(e => e.allowed ?? [])),
    denied: mergeEntries(entries.flatMap(e => e.denied ?? [])),
  };
}

function mergeEntries(entries: CapabilityResource[]): CapabilityResource[] {
  const dedup = new Map<string, CapabilityResource>();
  for (const e of entries) {
    const key = entryKey(e);
    if (!dedup.has(key)) dedup.set(key, e);
  }
  return Array.from(dedup.values());
}

function entryKey(entry: CapabilityResource): string {
  // JSON-encode to avoid the (theoretical) collision when a path or
  // expression contains the previous delimiters. Sort expressions so the
  // dedup key is stable across input orderings.
  const exprs = [...(entry.constraints?.expressions ?? [])].sort();
  return JSON.stringify([entry.path, exprs]);
}

/** True if the entry carries at least one CEL expression. */
export function isConstrained(entry: CapabilityResource): boolean {
  return (entry.constraints?.expressions?.length ?? 0) > 0;
}
