import {
  NO_ENDPOINT,
  endpointTypeKey,
  exposableVisibilities,
  parseEndpointTypeKey,
  resolveEndpointType,
  type AllowedEndpointTypeEntry,
  type ComponentEndpointSummary,
  type EndpointExposures,
  type ExposableEndpoint,
} from '@openchoreo/backstage-plugin-common';
import {
  deepCompareObjects,
  type Change,
} from '@openchoreo/backstage-plugin-react';

/**
 * The two forms of the configure page's Endpoints tab. In the Endpoints
 * form each workload endpoint with a visibility beyond project is exposed
 * through an Endpoint, which carries that visibility. In the legacy form the
 * visibility stays on the workload (deprecated) and the component has no
 * Endpoints; the ComponentType's own routes serve it, if it defines any.
 */
export type EndpointFormMode = 'endpoints' | 'legacy';

/**
 * The form the page opens with, derived from the component's data: legacy
 * only when workload endpoints carry the deprecated visibility and the
 * component has no Endpoints; the Endpoints form otherwise, even when the
 * ComponentType allows no Endpoint types.
 */
export function initialEndpointMode(
  endpoints: Record<string, ExposableEndpoint>,
  originals: ComponentEndpointSummary[],
): EndpointFormMode {
  if (originals.length > 0) return 'endpoints';
  return Object.values(endpoints).some(e => exposableVisibilities(e).length > 0)
    ? 'legacy'
    : 'endpoints';
}

/**
 * The calls that save a component's Endpoints from its configure page. In
 * the Endpoints form each workload endpoint is exposed through at most one
 * Endpoint, of the type chosen in its row; the Endpoint carries the row's
 * visibilities beyond project. A changed type replaces the Endpoint, since
 * its type is immutable. The legacy form deletes every Endpoint.
 */
export type EndpointChange =
  | {
      op: 'create';
      workloadEndpoint: string;
      typeKey: string;
      visibility: string[];
      parameters: Record<string, unknown>;
    }
  | {
      op: 'update';
      original: ComponentEndpointSummary;
      workloadEndpoint: string;
      visibility: string[];
      parameters: Record<string, unknown>;
    }
  | {
      op: 'delete';
      original: ComponentEndpointSummary;
      reason:
        | 'notExposed'
        | 'workloadEndpointRemoved'
        | 'typeChanged'
        | 'legacyForm';
    };

export interface EndpointPlanInput {
  mode: EndpointFormMode;
  /** The workload endpoints as edited, visibility included. */
  endpoints: Record<string, ExposableEndpoint>;
  allowedEndpoints: AllowedEndpointTypeEntry[];
  /** The Endpoint type chosen per workload endpoint, by current name. */
  choices: EndpointExposures;
  /** The component's Endpoints as on the server. */
  originals: ComponentEndpointSummary[];
  /** Workload endpoints renamed on the page: old name → new name. */
  renames: Record<string, string>;
}

function originalTypeKey(original: ComponentEndpointSummary): string {
  return endpointTypeKey({ kind: original.typeKind, name: original.typeName });
}

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every(v => b.includes(v));
}

/** The workload endpoint an original Endpoint belongs to after renames. */
export function currentEndpointName(
  original: ComponentEndpointSummary,
  renames: Record<string, string>,
): string {
  return renames[original.workloadEndpoint] ?? original.workloadEndpoint;
}

/**
 * The Endpoint each workload endpoint is shown with: the first of the
 * component's Endpoints routing to it. Further ones (left from an older
 * per-visibility split) are kept as they are.
 */
export function primaryOriginals(
  originals: ComponentEndpointSummary[],
  renames: Record<string, string>,
): Map<string, ComponentEndpointSummary> {
  const primary = new Map<string, ComponentEndpointSummary>();
  for (const original of originals) {
    const name = currentEndpointName(original, renames);
    if (!primary.has(name)) primary.set(name, original);
  }
  return primary;
}

/**
 * The workload endpoints exposed through an Endpoint after saving, whose
 * visibility beyond project the workload no longer carries. None in the
 * legacy form.
 */
export function exposedEndpointNames(input: EndpointPlanInput): string[] {
  if (input.mode === 'legacy') return [];
  return Object.entries(input.endpoints)
    .filter(
      ([name, endpoint]) =>
        exposableVisibilities(endpoint).length > 0 &&
        resolveEndpointType(
          endpoint,
          input.allowedEndpoints,
          input.choices[name],
        ) !== NO_ENDPOINT,
    )
    .map(([name]) => name);
}

/**
 * Plans the Endpoint calls that bring the server in line with the page:
 * deletes first, so a replacement never clashes with what it replaces, then
 * updates and creates.
 */
export function planEndpointChanges(
  input: EndpointPlanInput,
): EndpointChange[] {
  if (input.mode === 'legacy') {
    return input.originals.map(original => ({
      op: 'delete',
      original,
      reason: 'legacyForm',
    }));
  }
  const deletes: EndpointChange[] = [];
  const updates: EndpointChange[] = [];
  const creates: EndpointChange[] = [];
  const primary = primaryOriginals(input.originals, input.renames);

  for (const original of input.originals) {
    const name = currentEndpointName(original, input.renames);
    if (!input.endpoints[name] && primary.get(name) === original) {
      deletes.push({
        op: 'delete',
        original,
        reason: 'workloadEndpointRemoved',
      });
    }
  }

  for (const [name, endpoint] of Object.entries(input.endpoints)) {
    const visibility = exposableVisibilities(endpoint);
    const typeKey = resolveEndpointType(
      endpoint,
      input.allowedEndpoints,
      input.choices[name],
    );
    const parameters = input.choices[name]?.parameters ?? {};
    const want = visibility.length > 0 && typeKey !== NO_ENDPOINT;
    const original = primary.get(name);

    if (!original) {
      if (want) {
        creates.push({
          op: 'create',
          workloadEndpoint: name,
          typeKey,
          visibility,
          parameters,
        });
      }
      continue;
    }
    if (!want) {
      deletes.push({ op: 'delete', original, reason: 'notExposed' });
      continue;
    }
    if (originalTypeKey(original) !== typeKey) {
      deletes.push({ op: 'delete', original, reason: 'typeChanged' });
      creates.push({
        op: 'create',
        workloadEndpoint: name,
        typeKey,
        visibility,
        parameters,
      });
      continue;
    }
    if (
      !sameSet(visibility, original.visibility) ||
      deepCompareObjects(original.parameters ?? {}, parameters).length > 0 ||
      name !== original.workloadEndpoint
    ) {
      updates.push({
        op: 'update',
        original,
        workloadEndpoint: name,
        visibility,
        parameters,
      });
    }
  }
  return [...deletes, ...updates, ...creates];
}

const DELETE_REASONS = {
  notExposed: 'Deleted (no visibility beyond project)',
  workloadEndpointRemoved: 'Deleted (workload endpoint removed)',
  typeChanged: 'Replaced (endpoint type changed)',
  legacyForm: 'Deleted (switched to legacy endpoints)',
};

/**
 * What switching forms does on save, for the save confirmation; null when
 * the page is still in the form it opened with.
 */
export function endpointFormSwitchSummary(
  initialMode: EndpointFormMode,
  mode: EndpointFormMode,
  changes: EndpointChange[],
): string | null {
  if (initialMode === mode) return null;
  if (mode === 'legacy') {
    const deleted = changes.flatMap(c =>
      c.op === 'delete' ? [c.original.name] : [],
    );
    return deleted.length > 0
      ? `Switches to legacy endpoints. Deletes Endpoints ${deleted.join(
          ', ',
        )}: their visibility is stored on the workload instead and served by the component type's own routes, if it defines any, possibly at a different host.`
      : 'Switches to legacy endpoints: visibility beyond project is stored on the workload.';
  }
  const moved = changes.flatMap(c =>
    c.op === 'create' ? [c.workloadEndpoint] : [],
  );
  return moved.length > 0
    ? `Switches to Endpoints. Moves ${moved.length} endpoint${
        moved.length === 1 ? '' : 's'
      } to Endpoints (${moved.join(
        ', ',
      )}): their visibility beyond project leaves the workload.`
    : 'Switches to Endpoints: endpoints with visibility beyond project are exposed through Endpoints.';
}

/** The planned Endpoint calls, as the save confirmation lists them. */
export function endpointChangeList(changes: EndpointChange[]): Change[] {
  const list: Change[] = [];
  for (const change of changes) {
    switch (change.op) {
      case 'create':
        list.push({
          path: `new Endpoint for ${change.workloadEndpoint}`,
          type: 'new',
          newValue: `${
            parseEndpointTypeKey(change.typeKey).name
          } · ${change.visibility.join(', ')}`,
        });
        break;
      case 'delete':
        list.push({
          path: change.original.name,
          type: 'removed',
          oldValue: DELETE_REASONS[change.reason],
        });
        break;
      case 'update': {
        const { original } = change;
        const label = original.name;
        if (change.workloadEndpoint !== original.workloadEndpoint) {
          list.push({
            path: `${label}.workloadEndpoint`,
            type: 'modified',
            oldValue: original.workloadEndpoint,
            newValue: change.workloadEndpoint,
          });
        }
        if (!sameSet(change.visibility, original.visibility)) {
          list.push({
            path: `${label}.visibility`,
            type: 'modified',
            oldValue: original.visibility.join(', '),
            newValue: change.visibility.join(', '),
          });
        }
        for (const diff of deepCompareObjects(
          original.parameters ?? {},
          change.parameters,
        )) {
          list.push({ ...diff, path: `${label}.parameters.${diff.path}` });
        }
        break;
      }
      default:
        break;
    }
  }
  return list;
}
