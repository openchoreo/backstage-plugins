/**
 * Wire codec for the `kindCapabilitiesJson` rule parameter.
 *
 * Backstage rule params only support primitives, so the per-kind capability
 * map travels as a JSON string. That string is repeated **once per resource**
 * in the batched `POST /.well-known/backstage/permissions/apply-conditions`
 * body, and the receiving router parses it with `express.json()` — a
 * non-configurable 100 KB limit. A page of 25 search hits therefore multiplies
 * the condition payload by 25, so keeping the serialized form small is a
 * correctness concern, not a micro-optimisation.
 *
 * The compact form pools the capability paths and groups the kinds that share
 * the same allow/deny sets — in practice most managed kinds resolve to the
 * same paths, so the payload stops scaling with the number of managed kinds.
 */

/** Capability data for a single entity kind. */
export interface KindCapability {
  /**
   * The OpenChoreo action this kind resolves to (e.g. `component:view`).
   *
   * @deprecated Informational only — never read when evaluating the rule, and
   * omitted from the serialized form to keep the condition payload small.
   */
  action?: string;
  /** Allowed paths from the user's capabilities for this kind. */
  allowedPaths: string[];
  /** Denied paths from the user's capabilities for this kind. */
  deniedPaths: string[];
}

export type KindCapabilities = Record<string, KindCapability>;

/**
 * Compact wire shape: a shared path pool (`p`) plus capability groups (`g`),
 * each listing the kinds (`k`) that share its allowed (`a`) and denied (`d`)
 * path indices.
 */
interface CompactKindCapabilities {
  v: 1;
  p: string[];
  g: { k: string[]; a: number[]; d: number[] }[];
}

/** Serializes a kind capability map into the compact wire form. */
export function encodeKindCapabilities(
  kindCapabilities: KindCapabilities,
): string {
  const pool: string[] = [];
  const poolIndex = new Map<string, number>();
  const intern = (path: string): number => {
    const existing = poolIndex.get(path);
    if (existing !== undefined) {
      return existing;
    }
    const index = pool.length;
    pool.push(path);
    poolIndex.set(path, index);
    return index;
  };

  // Group kinds whose allow/deny sets are identical. Paths are sorted so that
  // kinds resolving to the same scopes group regardless of input ordering —
  // both `apply` and `toQuery` treat the lists as unordered sets.
  const groups = new Map<string, { k: string[]; a: number[]; d: number[] }>();
  for (const [kind, capability] of Object.entries(kindCapabilities)) {
    const allowed = [...new Set(capability.allowedPaths)].sort();
    const denied = [...new Set(capability.deniedPaths)].sort();
    const groupKey = JSON.stringify([allowed, denied]);

    const existing = groups.get(groupKey);
    if (existing) {
      existing.k.push(kind);
      continue;
    }
    groups.set(groupKey, {
      k: [kind],
      a: allowed.map(intern),
      d: denied.map(intern),
    });
  }

  const compact: CompactKindCapabilities = {
    v: 1,
    p: pool,
    g: Array.from(groups.values()),
  };
  return JSON.stringify(compact);
}

/**
 * Parses a `kindCapabilitiesJson` param.
 *
 * Accepts the compact form as well as the plain `Record<kind, KindCapability>`
 * form emitted by earlier releases, so a mixed-version deployment (policy and
 * catalog running different images) keeps working.
 */
export function decodeKindCapabilities(json: string): KindCapabilities {
  const parsed = JSON.parse(json);

  if (!isCompact(parsed)) {
    return parsed as KindCapabilities;
  }

  const pool = parsed.p;
  const resolve = (indices: number[]): string[] =>
    indices
      .map(i => pool[i])
      .filter((path): path is string => path !== undefined);

  const kindCapabilities: KindCapabilities = {};
  for (const group of parsed.g) {
    const allowedPaths = resolve(group.a);
    const deniedPaths = resolve(group.d);
    for (const kind of group.k) {
      // Copy per kind so a caller mutating one kind's list cannot affect the
      // other kinds that happened to share the group.
      kindCapabilities[kind] = {
        allowedPaths: [...allowedPaths],
        deniedPaths: [...deniedPaths],
      };
    }
  }
  return kindCapabilities;
}

function isCompact(value: unknown): value is CompactKindCapabilities {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as CompactKindCapabilities).v === 1 &&
    Array.isArray((value as CompactKindCapabilities).p) &&
    Array.isArray((value as CompactKindCapabilities).g)
  );
}
