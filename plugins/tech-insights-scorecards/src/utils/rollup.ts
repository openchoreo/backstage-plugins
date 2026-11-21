import {
  parseEntityRef,
  RELATION_HAS_PART,
  RELATION_OWNER_OF,
  RELATION_PARENT_OF,
  RELATION_PART_OF,
  stringifyEntityRef,
  type Entity,
} from '@backstage/catalog-model';
import type {
  MaturityCheckResult,
  Rank,
} from '@backstage-community/plugin-tech-insights-maturity-common';
import { progressOf, rankOf, type CheckProgress } from './scoring';
import { isKind, type VariantConfig } from './variants';

/**
 * The relations a kind's rollup follows to the entities that belong to it,
 * keyed by lowercase kind. Each level is followed in turn, so a Domain
 * reaches its Systems and, through them, their components.
 */
export const ROLLUP_RELATIONS: Record<string, string[]> = {
  domain: [RELATION_HAS_PART],
  system: [RELATION_HAS_PART],
  group: [RELATION_PARENT_OF, RELATION_OWNER_OF],
};

/**
 * Own keys only, so a kind named after an `Object.prototype` member, such as
 * `Constructor`, isn't taken for a rollup kind.
 */
function relationsOf(kind: string): string[] | undefined {
  const key = kind.toLocaleLowerCase('en-US');
  return Object.prototype.hasOwnProperty.call(ROLLUP_RELATIONS, key)
    ? ROLLUP_RELATIONS[key]
    : undefined;
}

export function isRollupKind(kind: string): boolean {
  return relationsOf(kind) !== undefined;
}

/**
 * One form for every entity ref, so refs from the catalog, from relations
 * and from check results key the same maps.
 */
export function normalizeRef(ref: string | Entity): string {
  return stringifyEntityRef(
    typeof ref === 'string' ? parseEntityRef(ref) : ref,
  );
}

function isVariantRef(ref: string, variants: VariantConfig | undefined) {
  return !!variants && isKind(parseEntityRef(ref).kind, variants.kind);
}

/**
 * Refs of the entities that directly belong to `entity`. Variants are left
 * out, since they are listed only under their parent. Otherwise a Group that
 * owns a component and its release lines would list the lines twice.
 */
export function childRefsOf(
  entity: Entity,
  variants?: VariantConfig,
): string[] {
  const types = relationsOf(entity.kind);
  if (!types) return [];
  return Array.from(
    new Set(
      (entity.relations ?? [])
        .filter(relation => types.includes(relation.type))
        .map(relation => normalizeRef(relation.targetRef))
        .filter(ref => !isVariantRef(ref, variants)),
    ),
  );
}

/**
 * Refs of `entity`'s variants: its `hasPart` targets of the variant kind.
 * `hasPart` also links a component to its Backstage subcomponents, which
 * aren't variants.
 */
export function variantRefsOf(
  entity: Entity,
  variants?: VariantConfig,
): string[] {
  if (!variants || !isKind(entity.kind, variants.parentKind)) return [];
  return Array.from(
    new Set(
      (entity.relations ?? [])
        .filter(relation => relation.type === RELATION_HAS_PART)
        .map(relation => normalizeRef(relation.targetRef))
        .filter(ref => isVariantRef(ref, variants)),
    ),
  );
}

/** The ref of the parent a variant belongs to, through `partOf`. */
export function variantParentRefOf(
  entity: Entity,
  variants?: VariantConfig,
): string | undefined {
  if (!variants || !isKind(entity.kind, variants.kind)) return undefined;
  return (entity.relations ?? [])
    .filter(relation => relation.type === RELATION_PART_OF)
    .map(relation => normalizeRef(relation.targetRef))
    .find(ref => isKind(parseEntityRef(ref).kind, variants.parentKind));
}

export interface RollupNode {
  ref: string;
  entity: Entity;
  /** Results of the checks run against this entity itself. */
  ownChecks: MaturityCheckResult[];
  /** The entities that directly belong to it. */
  children: RollupNode[];
  /**
   * Entities scored apart from it, such as a component's release lines.
   * They count towards none of its checks, tier, progress or descendants.
   */
  variants: RollupNode[];
  /** Its own results plus those of every distinct entity beneath it. */
  checks: MaturityCheckResult[];
  rank: Rank;
  progress: CheckProgress;
  /** False when no check applies to it or to anything beneath it. */
  scored: boolean;
  /** Distinct entities beneath it, at any depth. */
  descendantCount: number;
}

function displayName(entity: Entity): string {
  return entity.metadata.title ?? entity.metadata.name;
}

/** Scored first, lowest tier first, then by name. */
export function compareNodes(a: RollupNode, b: RollupNode): number {
  return (
    Number(b.scored) - Number(a.scored) ||
    a.rank - b.rank ||
    displayName(a.entity).localeCompare(displayName(b.entity))
  );
}

/**
 * Builds rollup nodes from catalog entities and their own check results,
 * both keyed by `normalizeRef`. Children missing from `entities` are left
 * out. An entity reached twice beneath one parent, for example a component
 * a Group owns directly and through its System, counts once in the parent's
 * results. Nodes outside relation cycles are memoized, so building every
 * entity of a catalog costs one pass. With `variants`, a parent's variants
 * found in `entities` are built as nodes of their own beside its children.
 */
export function createRollup(
  entities: Map<string, Entity>,
  results: Map<string, MaturityCheckResult[]>,
  variants?: VariantConfig,
) {
  const built = new Map<
    string,
    { node: RollupNode; subtree: Set<string>; cut: boolean }
  >();

  function build(ref: string, path: Set<string>) {
    const cached = built.get(ref);
    if (cached) return cached;
    const entity = entities.get(ref);
    if (!entity) return undefined;

    const nextPath = new Set(path).add(ref);
    const subtree = new Set([ref]);
    const children: RollupNode[] = [];
    let cut = false;
    for (const childRef of childRefsOf(entity, variants)) {
      // A relation cycle would otherwise recurse forever.
      if (nextPath.has(childRef)) {
        cut = true;
        continue;
      }
      const child = build(childRef, nextPath);
      if (!child) continue;
      children.push(child.node);
      child.subtree.forEach(r => subtree.add(r));
      if (child.cut) cut = true;
    }
    const variantNodes: RollupNode[] = [];
    for (const variantRef of variantRefsOf(entity, variants)) {
      if (nextPath.has(variantRef)) {
        cut = true;
        continue;
      }
      const variant = build(variantRef, nextPath);
      if (!variant) continue;
      variantNodes.push(variant.node);
      if (variant.cut) cut = true;
    }

    const ownChecks = results.get(ref) ?? [];
    const checks = Array.from(subtree).flatMap(r => results.get(r) ?? []);
    const node: RollupNode = {
      ref,
      entity,
      ownChecks,
      children: children.sort(compareNodes),
      variants: variantNodes.sort(compareNodes),
      checks,
      rank: rankOf(checks),
      progress: progressOf(checks),
      scored: checks.length > 0,
      descendantCount: subtree.size - 1,
    };
    const entry = { node, subtree, cut };
    // A node cut by a cycle depends on the path that reached it.
    if (!cut) built.set(ref, entry);
    return entry;
  }

  return (ref: string): RollupNode | undefined =>
    build(normalizeRef(ref), new Set())?.node;
}
