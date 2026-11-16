import {
  NO_ENDPOINT,
  endpointTypeKey,
  exposableVisibilities,
  parseEndpointTypeKey,
  resolveEndpointType,
  type AllowedEndpointTypeEntry,
  type ComponentEndpointSummary,
  type EndpointExposureChoice,
  type EndpointExposures,
  type ExposableEndpoint,
} from '@openchoreo/backstage-plugin-common';
import {
  deepCompareObjects,
  type Change,
} from '@openchoreo/backstage-plugin-react';

/**
 * The two forms of the configure page's Endpoints tab, decided by the
 * component's ComponentType. In the Endpoints form each workload endpoint
 * with a visibility beyond project is exposed through an Endpoint, which
 * carries that visibility; a row gets an Endpoint only when one is added
 * for it (see rowEndpointType). The legacy form is for ComponentTypes
 * annotated `openchoreo.dev/legacy-endpoints: "true"`: the visibility stays
 * on the workload (deprecated), the type's own routes serve it, and the
 * component's Endpoints aren't touched.
 */
export type EndpointFormMode = 'endpoints' | 'legacy';

/**
 * The Endpoint type a row is exposed through: the type of its Endpoint, or of
 * the one added for it on the page (a release line's drafts count as added),
 * falling back to the protocol's default when that type is no longer allowed.
 * NO_ENDPOINT for a row without one: visibility beyond project alone doesn't
 * create an Endpoint, so a workload that still carries it keeps it there
 * (deprecated) until someone adds an Endpoint.
 */
export function rowEndpointType(
  endpoint: ExposableEndpoint,
  allowedEndpoints: AllowedEndpointTypeEntry[],
  choice: EndpointExposureChoice | undefined,
): string {
  return choice
    ? resolveEndpointType(endpoint, allowedEndpoints, choice)
    : NO_ENDPOINT;
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
      reason: 'notExposed' | 'workloadEndpointRemoved' | 'typeChanged';
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
        rowEndpointType(
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
 * updates and creates. The legacy form plans none: its component keeps its
 * visibility on the workload.
 */
export function planEndpointChanges(
  input: EndpointPlanInput,
): EndpointChange[] {
  if (input.mode === 'legacy') return [];
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
    const typeKey = rowEndpointType(
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
};

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
