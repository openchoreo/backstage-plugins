import {
  parseEntityRef,
  RELATION_HAS_PART,
  RELATION_OWNER_OF,
  RELATION_PARENT_OF,
  stringifyEntityRef,
  type Entity,
} from '@backstage/catalog-model';
import type {
  MaturityCheckResult,
  Rank,
} from '@backstage-community/plugin-tech-insights-maturity-common';
import { progressOf, rankOf, type CheckProgress } from './scoring';

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

export function isRollupKind(kind: string): boolean {
  return kind.toLocaleLowerCase('en-US') in ROLLUP_RELATIONS;
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

/** Refs of the entities that directly belong to `entity`. */
export function childRefsOf(entity: Entity): string[] {
  const types = ROLLUP_RELATIONS[entity.kind.toLocaleLowerCase('en-US')];
  if (!types) return [];
  return Array.from(
    new Set(
      (entity.relations ?? [])
        .filter(relation => types.includes(relation.type))
        .map(relation => normalizeRef(relation.targetRef)),
    ),
  );
}

export interface RollupNode {
  ref: string;
  entity: Entity;
  /** Results of the checks run against this entity itself. */
  ownChecks: MaturityCheckResult[];
  /** The entities that directly belong to it. */
  children: RollupNode[];
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
 * results. Nodes are memoized, so building every entity of a catalog costs
 * one pass.
 */
export function createRollup(
  entities: Map<string, Entity>,
  results: Map<string, MaturityCheckResult[]>,
) {
  const built = new Map<string, { node: RollupNode; subtree: Set<string> }>();

  function build(ref: string, path: Set<string>) {
    const cached = built.get(ref);
    if (cached) return cached;
    const entity = entities.get(ref);
    if (!entity) return undefined;

    const nextPath = new Set(path).add(ref);
    const subtree = new Set([ref]);
    const children: RollupNode[] = [];
    for (const childRef of childRefsOf(entity)) {
      // A relation cycle would otherwise recurse forever.
      if (nextPath.has(childRef)) continue;
      const child = build(childRef, nextPath);
      if (!child) continue;
      children.push(child.node);
      child.subtree.forEach(r => subtree.add(r));
    }

    const ownChecks = results.get(ref) ?? [];
    const checks = Array.from(subtree).flatMap(r => results.get(r) ?? []);
    const node: RollupNode = {
      ref,
      entity,
      ownChecks,
      children: children.sort(compareNodes),
      checks,
      rank: rankOf(checks),
      progress: progressOf(checks),
      scored: checks.length > 0,
      descendantCount: subtree.size - 1,
    };
    const entry = { node, subtree };
    built.set(ref, entry);
    return entry;
  }

  return (ref: string): RollupNode | undefined =>
    build(normalizeRef(ref), new Set())?.node;
}
