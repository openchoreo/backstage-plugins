/**
 * How a release line's overrides combine with its component, mirroring the
 * OpenChoreo controller: parameters (and workflow parameters) are deep-merged
 * onto the component's, and traits are merged by kind, name and instance name.
 */

type PlainObject = Record<string, unknown>;

/** A trait as a component or release line declares it. */
export interface ReleaseLineTrait {
  kind?: string;
  name: string;
  instanceName: string;
  parameters?: PlainObject;
}

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => isEqual(item, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every(key => isEqual(a[key], b[key]));
  }
  return false;
}

/** Deep-merges `override` onto `base`; objects merge, anything else replaces. */
export function mergeOverrides(
  base: PlainObject | undefined,
  override: PlainObject | undefined,
): PlainObject {
  const result: PlainObject = { ...(base ?? {}) };
  for (const [key, value] of Object.entries(override ?? {})) {
    const current = result[key];
    result[key] =
      isPlainObject(current) && isPlainObject(value)
        ? mergeOverrides(current, value)
        : value;
  }
  return result;
}

/**
 * The smallest override that, deep-merged onto `base`, yields `value`: the
 * keys whose values differ from `base`. Keys `base` has but `value` lacks
 * cannot be expressed as an override and are left inherited.
 */
export function diffOverrides(
  value: PlainObject | undefined,
  base: PlainObject | undefined,
): PlainObject {
  const result: PlainObject = {};
  for (const [key, current] of Object.entries(value ?? {})) {
    const inherited = base?.[key];
    if (isPlainObject(current) && isPlainObject(inherited)) {
      const nested = diffOverrides(current, inherited);
      if (Object.keys(nested).length > 0) {
        result[key] = nested;
      }
    } else if (!isEqual(current, inherited)) {
      result[key] = current;
    }
  }
  return result;
}

/** Identity of a trait when merging a release line's traits onto its component's. */
export function traitKey(trait: ReleaseLineTrait): string {
  return `${trait.kind ?? 'Trait'}/${trait.name}/${trait.instanceName}`;
}

/** The component's traits with the release line's traits merged in. */
export function mergeTraits<T extends ReleaseLineTrait>(
  base: T[] | undefined,
  override: T[] | undefined,
): T[] {
  const overrides = new Map((override ?? []).map(t => [traitKey(t), t]));
  const merged = (base ?? []).map(trait => {
    const replacement = overrides.get(traitKey(trait));
    overrides.delete(traitKey(trait));
    return replacement
      ? { ...trait, ...replacement, parameters: replacement.parameters }
      : trait;
  });
  return [...merged, ...overrides.values()];
}

/**
 * The traits a release line must declare so that, merged onto `base`, they
 * yield `value`: new traits, and inherited traits whose configuration changed.
 */
export function diffTraits<T extends ReleaseLineTrait>(
  value: T[] | undefined,
  base: T[] | undefined,
): T[] {
  const inherited = new Map((base ?? []).map(t => [traitKey(t), t]));
  return (value ?? []).filter(trait => {
    const original = inherited.get(traitKey(trait));
    return (
      !original || !isEqual(trait.parameters ?? {}, original.parameters ?? {})
    );
  });
}

/** Whether a trait comes from the component rather than the release line alone. */
export function isInheritedTrait(
  trait: ReleaseLineTrait,
  base: ReleaseLineTrait[] | undefined,
): boolean {
  return (base ?? []).some(t => traitKey(t) === traitKey(trait));
}
