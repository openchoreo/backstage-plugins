import type { Entity } from '@backstage/catalog-model';
import { CHOREO_LABELS } from './constants';

/**
 * True when an entity carries the `openchoreo.io/managed=true` label — the
 * marker every OpenChoreo entity provider stamps onto entities it emits.
 *
 * Use this as the discriminator whenever an OpenChoreo blueprint's filter
 * targets an entity kind that Backstage adopters may also use (Component,
 * System, Domain, User, Group, API), OR any kind name generic enough that a
 * third-party plugin could contribute an entity of the same kind
 * (Environment, Workflow, ResourceType, etc.). Under NFS with feature
 * discovery, our blueprints auto-attach — this label keeps our layouts,
 * tabs, cards, and context-menu items from leaking onto adopter entities.
 *
 * All OpenChoreo entity emitters set this label unconditionally:
 * - `catalog-backend-module-openchoreo` (`utils/entityTranslation.ts` +
 *   `utils/helpers.ts`) — the primary catalog sync path.
 * - Scaffolder actions do NOT emit Backstage entities directly; they
 *   produce OpenChoreo API resources (`apiVersion: openchoreo.dev/v1alpha1`)
 *   which flow back through the catalog provider — where the label is
 *   applied. So the label survives the round-trip.
 *
 * If a new emitter is added that bypasses the catalog provider, it MUST
 * also set this label or entities will silently fall out of every OC UI.
 */
export function isOpenChoreoManagedEntity(entity: Entity): boolean {
  return entity.metadata.labels?.[CHOREO_LABELS.MANAGED] === 'true';
}

/**
 * Higher-order helper producing a filter predicate for an
 * `EntityContentBlueprint`, `EntityCardBlueprint`, or
 * `EntityContentLayoutBlueprint`. Matches entities whose kind is in the
 * given list AND that carry the `openchoreo.io/managed=true` label.
 *
 * @example
 *   const componentDeployEntityContent = EntityContentBlueprint.make({
 *     name: 'component-deploy',
 *     params: {
 *       filter: isOpenChoreoManagedOfKind('component'),
 *       // ...
 *     },
 *   });
 *
 * Under-the-hood: kinds are lowercased once at helper-call time; each
 * entity's `kind` is lowercased once per filter invocation. Both cheap.
 */
export function isOpenChoreoManagedOfKind(
  ...kinds: string[]
): (entity: Entity) => boolean {
  const lc = new Set(kinds.map(k => k.toLowerCase()));
  return entity =>
    lc.has(entity.kind.toLowerCase()) && isOpenChoreoManagedEntity(entity);
}
