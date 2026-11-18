import {
  NO_ENDPOINT,
  endpointTypeKey,
  endpointVisibilities,
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
 * The form of the configure page's Endpoints tab, decided by the component's
 * ComponentType:
 * - `legacy`, for a type annotated `openchoreo.dev/legacy-endpoints: "true"`:
 *   the workload endpoint editor, with visibility on the workload
 *   (deprecated), served by the type's own templated routes;
 * - `endpoints`, for a type with `allowedEndpoints`: one card per endpoint,
 *   whose visibility, project included, is carried by an Endpoint;
 * - `none`, for a type with neither: no form, and saving changes no
 *   Endpoints.
 */
export type EndpointFormMode = 'endpoints' | 'legacy' | 'none';

/**
 * The endpoints the Endpoints tab lists, as the form decides: in the
 * Endpoints form one card per endpoint, except workload endpoints from
 * before Endpoints that are still as loaded (their visibility stays on the
 * workload until a card replaces them); none without a form; every workload
 * endpoint in the legacy form.
 */
export function endpointCards<T extends ExposableEndpoint>(
  endpoints: Record<string, T>,
  mode: EndpointFormMode | undefined,
  deprecatedRows: Record<string, ExposableEndpoint> | undefined,
): Record<string, T> {
  if (mode === 'none') return {};
  if (mode !== 'endpoints' || !deprecatedRows) return endpoints;
  return Object.fromEntries(
    Object.entries(endpoints).filter(
      ([name, endpoint]) =>
        !deprecatedRows[name] ||
        JSON.stringify(deprecatedRows[name]) !== JSON.stringify(endpoint),
    ),
  );
}

/**
 * The Endpoint type a row is exposed through: the type chosen for it, which
 * its Endpoint, a release line's draft, or the card's editor sets, falling
 * back to the protocol's default when that type is no longer allowed.
 * NO_ENDPOINT for a row without a choice: a workload endpoint that still
 * carries visibility beyond project from before Endpoints, and has no card,
 * keeps it on the workload.
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
 * visibilities, project included. A changed type replaces the Endpoint, since
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
 * visibility the Endpoint carries rather than the workload. None outside
 * the Endpoints form.
 */
export function exposedEndpointNames(input: EndpointPlanInput): string[] {
  if (input.mode !== 'endpoints') return [];
  return Object.entries(input.endpoints)
    .filter(
      ([name, endpoint]) =>
        endpointVisibilities(endpoint).length > 0 &&
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
 * updates and creates. Only the Endpoints form plans any: the legacy form
 * keeps visibility on the workload, and without a form nothing changes.
 */
export function planEndpointChanges(
  input: EndpointPlanInput,
): EndpointChange[] {
  if (input.mode !== 'endpoints') return [];
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
    const visibility = endpointVisibilities(endpoint);
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
  notExposed: 'Deleted (no visibility)',
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
