import YAML from 'yaml';
import {
  NO_ENDPOINT,
  buildComponentEndpoint,
  componentEndpointName,
  endpointProtocol,
  endpointTypeCandidates,
  endpointTypeKey,
  endpointTypeOptions,
  endpointVisibilities,
  parseEndpointTypeKey,
  type AllowedEndpointTypeEntry,
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
  /**
   * Whether the Endpoint is created on save. Its type and the workload
   * endpoint it routes to can still change; an existing one's can't.
   */
  isNew: boolean;
  resource: Record<string, unknown>;
}

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
    endpointCards(endpoints, state.mode, state.deprecatedRows, state.choices),
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
      isNew: !original,
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

/**
 * Whether a parsed value refers back to itself. YAML aliases can build such
 * a value, which nothing downstream can compare or send.
 */
function isCyclic(value: unknown, ancestors: unknown[] = []): boolean {
  if (typeof value !== 'object' || value === null) return false;
  if (ancestors.includes(value)) return true;
  const next = [...ancestors, value];
  return Object.values(value).some(v => isCyclic(v, next));
}

/** An EndpointType key as the YAML writes it: `<kind>/<name>`. */
function typeLabel(key: string): string {
  const { kind, name } = parseEndpointTypeKey(key);
  return `${kind}/${name}`;
}

function sortedJson(value: unknown): string {
  const sorted = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sorted);
    if (isPlainObject(v)) {
      return Object.fromEntries(
        Object.keys(v)
          .sort()
          .map(k => [k, sorted(v[k])]),
      );
    }
    return v;
  };
  return JSON.stringify(sorted(value));
}

/**
 * The resource without the fields that can be edited, for comparing. A new
 * Endpoint can also change its type and backend (and so its name, which
 * follows the workload endpoint); an existing one only its visibility and
 * parameters.
 */
function fixedPart(resource: Record<string, unknown>, isNew: boolean): string {
  const spec = isPlainObject(resource.spec) ? { ...resource.spec } : {};
  delete spec.visibility;
  delete spec.parameters;
  const fixed: Record<string, unknown> = { ...resource, spec };
  if (isNew) {
    delete spec.type;
    delete spec.backendRefs;
    const metadata = isPlainObject(resource.metadata)
      ? { ...resource.metadata }
      : {};
    delete metadata.name;
    fixed.metadata = metadata;
  }
  return sortedJson(fixed);
}

export interface EndpointYamlEdit {
  visibility: string[];
  parameters: Record<string, unknown>;
  /** A new Endpoint's EndpointType key; an existing one's doesn't change. */
  typeKey?: string;
  /** The workload endpoint a new Endpoint routes to. */
  workloadEndpoint?: string;
}

export interface EndpointYamlRules {
  /** Whether the Endpoint is created on save (see {@link EndpointYamlTab}). */
  isNew: boolean;
  allowedEndpoints?: AllowedEndpointTypeEntry[];
  /**
   * The workload endpoints a new Endpoint may route to: those in the
   * Workload without an Endpoint, and its own.
   */
  freeWorkloadEndpoints?: string[];
  /**
   * The Workload's endpoints, so a new Endpoint's type is checked against
   * the protocol of the workload endpoint it routes to.
   */
  workloadEndpoints?: Record<string, ExposableEndpoint>;
  componentName?: string;
}

const FIXED_FIELDS_ERROR =
  'Only spec.visibility and spec.parameters can be changed here. The name, owner, type and backends are set when the Endpoint is created.';
const NEW_FIXED_FIELDS_ERROR =
  'Only spec.type, spec.visibility, spec.parameters and the workload endpoint in spec.backendRefs can be set here. The name and owner are set on save.';

/**
 * Reads an edited Endpoint's YAML against the resource it was shown as. An
 * existing Endpoint can change its visibility and parameters. A new one can
 * also set its type, from those the ComponentType allows, and the workload
 * endpoint it routes to, which the Workload tab must have and no other
 * Endpoint may use.
 */
export function parseEndpointYaml(
  text: string,
  shown: Record<string, unknown>,
  rules: EndpointYamlRules = { isNew: false },
): EndpointYamlEdit | { error: string } {
  let parsed: unknown;
  try {
    parsed = YAML.parse(text);
  } catch (e) {
    return { error: `Invalid YAML: ${(e as Error).message}` };
  }
  if (isCyclic(parsed)) {
    return { error: 'Invalid YAML: an alias refers back to itself.' };
  }
  if (!isPlainObject(parsed)) {
    return { error: 'The Endpoint must be a YAML object.' };
  }
  if (fixedPart(parsed, rules.isNew) !== fixedPart(shown, rules.isNew)) {
    return { error: rules.isNew ? NEW_FIXED_FIELDS_ERROR : FIXED_FIELDS_ERROR };
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
  const edit: EndpointYamlEdit = {
    visibility: [...new Set(visibility as string[])],
    parameters,
  };
  if (!rules.isNew) return edit;

  const type = spec.type;
  const typeKey =
    isPlainObject(type) && typeof type.name === 'string'
      ? endpointTypeKey({
          kind: typeof type.kind === 'string' ? type.kind : undefined,
          name: type.name,
        })
      : undefined;
  const allowed = endpointTypeOptions(rules.allowedEndpoints ?? []);
  if (!typeKey || !allowed.some(o => o.key === typeKey)) {
    return {
      error: `spec.type must be one of the Endpoint types the component type allows: ${allowed
        .map(
          o =>
            `${parseEndpointTypeKey(o.key).kind}/${
              parseEndpointTypeKey(o.key).name
            }`,
        )
        .join(', ')}.`,
    };
  }
  const refs = spec.backendRefs;
  const ref = Array.isArray(refs) && refs.length === 1 ? refs[0] : undefined;
  const component = isPlainObject(ref) ? ref.component : undefined;
  if (
    !isPlainObject(component) ||
    component.name !== rules.componentName ||
    typeof component.endpoint !== 'string' ||
    !component.endpoint
  ) {
    return {
      error: `spec.backendRefs must have one backend on component ${rules.componentName}, naming its workload endpoint in component.endpoint.`,
    };
  }
  if (!(rules.freeWorkloadEndpoints ?? []).includes(component.endpoint)) {
    return {
      error: `Workload endpoint ${component.endpoint} isn't in the Workload tab, or another Endpoint already routes to it. Add it under spec.endpoints in the Workload tab.`,
    };
  }
  // The type must serve the workload endpoint's protocol, or the page would
  // expose it through the protocol's default type instead.
  const target = rules.workloadEndpoints?.[component.endpoint];
  if (target) {
    const protocol = endpointProtocol(target);
    const serving = endpointTypeCandidates(
      protocol,
      rules.allowedEndpoints ?? [],
    ).map(e => endpointTypeKey(e.ref));
    if (!serving.includes(typeKey)) {
      return {
        error:
          serving.length > 0
            ? `${typeLabel(
                typeKey,
              )} doesn't serve ${protocol}, the protocol of workload endpoint ${
                component.endpoint
              }. Use one of: ${serving.map(typeLabel).join(', ')}.`
            : `No Endpoint type the component type allows serves ${protocol}, the protocol of workload endpoint ${component.endpoint}. Change its protocol in the Workload tab.`,
      };
    }
  }
  return { ...edit, typeKey, workloadEndpoint: component.endpoint };
}

/**
 * The YAML a new Endpoint starts from in the YAML editor: the default
 * Endpoint type, project visibility, and a backend on the given workload
 * endpoint (a placeholder when none is free yet).
 */
export function newEndpointTemplate(
  state: ComponentEndpointsState,
  context: EndpointYamlContext,
  workloadEndpoint: string | undefined,
): Record<string, unknown> {
  const [first] = endpointTypeOptions(state.allowedEndpoints);
  const { kind, name: typeName } = parseEndpointTypeKey(
    first?.key ?? 'ClusterEndpointType/<endpoint-type>',
  );
  const endpoint = workloadEndpoint ?? '<workload-endpoint>';
  const built = buildComponentEndpoint({
    name: componentEndpointName(
      context.componentName,
      endpoint,
      undefined,
      state.releaseLine,
    ),
    componentName: context.componentName,
    projectName: context.projectName,
    releaseLine: state.releaseLine,
    workloadEndpoint: endpoint,
    typeKind: kind,
    typeName,
    visibility: ['project'],
    parameters: {},
    autoDeploy: true,
  });
  const spec: Record<string, unknown> = { ...built.spec, parameters: {} };
  delete spec.autoDeploy;
  return {
    apiVersion: 'openchoreo.dev/v1alpha1',
    kind: 'Endpoint',
    metadata: { name: built.metadata.name, namespace: context.namespaceName },
    spec,
  };
}
