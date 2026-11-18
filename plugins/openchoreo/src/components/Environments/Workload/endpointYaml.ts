import YAML from 'yaml';
import {
  NO_ENDPOINT,
  buildComponentEndpoint,
  componentEndpointName,
  endpointTypeKey,
  endpointVisibilities,
  parseEndpointTypeKey,
  type ExposableEndpoint,
} from '@openchoreo/backstage-plugin-common';
import {
  endpointCards,
  primaryOriginals,
  rowEndpointType,
} from './componentEndpointDrafts';
import type { ComponentEndpointsState } from './hooks/useComponentEndpoints';

/**
 * The YAML editor's tabs for a component's Endpoints: one per workload
 * endpoint exposed through an Endpoint, with the Endpoint resource as saving
 * will leave it.
 */
export interface EndpointYamlTab {
  /** The workload endpoint the Endpoint routes to; identifies the tab. */
  workloadEndpoint: string;
  /** The Endpoint's name, or the workload endpoint's for one not created yet. */
  label: string;
  /** The EndpointType key the Endpoint has. */
  typeKey: string;
  resource: Record<string, unknown>;
}

/** The only fields of an Endpoint's YAML that can be changed. */
export const EDITABLE_ENDPOINT_FIELDS = ['spec.visibility', 'spec.parameters'];

const VISIBILITIES = new Set(['project', 'namespace', 'internal', 'external']);

export interface EndpointYamlContext {
  componentName: string;
  projectName: string;
  namespaceName: string;
}

/**
 * The Endpoint resources a component's line has after saving, as the YAML
 * editor shows them: existing Endpoints with the page's changes, and new
 * ones as they will be created. A new Endpoint shows the name it's created
 * with first (the API may append its type when that name is taken), and no
 * `autoDeploy`, which saving sets from the page's auto deploy setting.
 */
export function endpointYamlTabs(
  endpoints: Record<string, ExposableEndpoint>,
  state: ComponentEndpointsState,
  context: EndpointYamlContext,
): EndpointYamlTab[] {
  if (state.mode !== 'endpoints') return [];
  const primary = primaryOriginals(state.originals, state.renames);
  const tabs: EndpointYamlTab[] = [];
  for (const [name, endpoint] of Object.entries(
    endpointCards(endpoints, state.mode, state.deprecatedRows),
  )) {
    const choice = state.choices[name];
    const typeKey = rowEndpointType(endpoint, state.allowedEndpoints, choice);
    const visibility = endpointVisibilities(endpoint);
    if (typeKey === NO_ENDPOINT || visibility.length === 0) continue;

    // A changed type replaces the Endpoint, so it's shown as a new one.
    const existing = primary.get(name);
    const original =
      existing &&
      endpointTypeKey({
        kind: existing.typeKind,
        name: existing.typeName,
      }) === typeKey
        ? existing
        : undefined;
    const { kind, name: typeName } = parseEndpointTypeKey(typeKey);
    const resourceName =
      original?.name ??
      componentEndpointName(
        context.componentName,
        name,
        undefined,
        state.releaseLine,
      );
    const built = buildComponentEndpoint({
      name: resourceName,
      componentName: context.componentName,
      projectName: context.projectName,
      releaseLine: state.releaseLine,
      workloadEndpoint: name,
      typeKind: kind,
      typeName,
      visibility,
      parameters: choice?.parameters ?? {},
      autoDeploy: original?.autoDeploy ?? true,
    });
    const spec: Record<string, unknown> = { ...built.spec };
    if (!original) delete spec.autoDeploy;
    tabs.push({
      workloadEndpoint: name,
      label: original ? original.name : `${name} (new)`,
      typeKey,
      resource: {
        apiVersion: 'openchoreo.dev/v1alpha1',
        kind: 'Endpoint',
        metadata: { name: resourceName, namespace: context.namespaceName },
        spec,
      },
    });
  }
  return tabs;
}

/** An Endpoint resource as YAML text. */
export function endpointToYaml(resource: Record<string, unknown>): string {
  return YAML.stringify(resource, { indent: 2 });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The resource without its editable fields, keys sorted, for comparing. */
function fixedPart(resource: Record<string, unknown>): string {
  const spec = isPlainObject(resource.spec) ? { ...resource.spec } : {};
  delete spec.visibility;
  delete spec.parameters;
  const sorted = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sorted);
    if (isPlainObject(value)) {
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .map(k => [k, sorted(value[k])]),
      );
    }
    return value;
  };
  return JSON.stringify(sorted({ ...resource, spec }));
}

export type EndpointYamlEdit =
  | { error: string }
  | { visibility: string[]; parameters: Record<string, unknown> };

/**
 * Reads an edited Endpoint's YAML against the resource it was shown as.
 * Only `spec.visibility` and `spec.parameters` can change; the name, owner,
 * type, backends and the rest are fixed by the form.
 */
export function parseEndpointYaml(
  text: string,
  shown: Record<string, unknown>,
): EndpointYamlEdit {
  let parsed: unknown;
  try {
    parsed = YAML.parse(text);
  } catch (e) {
    return { error: `Invalid YAML: ${(e as Error).message}` };
  }
  if (!isPlainObject(parsed)) {
    return { error: 'The Endpoint must be a YAML object.' };
  }
  if (fixedPart(parsed) !== fixedPart(shown)) {
    return {
      error:
        'Only spec.visibility and spec.parameters can be changed here. The name, owner, type and backends are set by the form.',
    };
  }
  const spec = isPlainObject(parsed.spec) ? parsed.spec : {};
  const visibility = spec.visibility;
  if (
    !Array.isArray(visibility) ||
    visibility.length === 0 ||
    !visibility.every(v => typeof v === 'string' && VISIBILITIES.has(v))
  ) {
    return {
      error:
        'spec.visibility must list at least one of project, namespace, internal and external.',
    };
  }
  const parameters = spec.parameters ?? {};
  if (!isPlainObject(parameters)) {
    return { error: 'spec.parameters must be an object.' };
  }
  return { visibility: [...new Set(visibility as string[])], parameters };
}
