import type { FetchApi } from '@backstage/core-plugin-api';

type PrimitiveValue = string | number | boolean;

export interface FieldChangeDef {
  json_pointer: string;
  value: PrimitiveValue;
}

export type TargetKind = 'ReleaseBinding' | 'ResourceReleaseBinding';

export interface ResourceChangeDef {
  target_kind?: TargetKind;
  release_binding: string;
  fields?: FieldChangeDef[];
  env?: Array<{ key: string; value: string }>;
  files?: Array<{ key: string; mount_path: string; value: string }>;
}

/** Reports predating the target_kind field describe Component bindings. */
export function resolveTargetKind(change: {
  target_kind?: string | null;
}): TargetKind {
  return change.target_kind === 'ResourceReleaseBinding'
    ? 'ResourceReleaseBinding'
    : 'ReleaseBinding';
}

export function bindingEndpoint(targetKind: TargetKind): string {
  return targetKind === 'ResourceReleaseBinding'
    ? 'resource-release-binding'
    : 'release-binding';
}

export function bindingLabel(targetKind: TargetKind): string {
  return targetKind === 'ResourceReleaseBinding'
    ? 'resource release binding'
    : 'release binding';
}

const ALLOWED_OVERRIDE_CATEGORIES: Record<TargetKind, Set<string>> = {
  ReleaseBinding: new Set([
    'workloadOverrides',
    'traitEnvironmentConfigs',
    'componentTypeEnvironmentConfigs',
  ]),
  ResourceReleaseBinding: new Set(['resourceTypeEnvironmentConfigs']),
};

export function applyJsonPointer(
  doc: any,
  pointer: string,
  value: any,
  targetKind: TargetKind = 'ReleaseBinding',
): void {
  const keys = pointer.replace(/^\//, '').split('/');
  if (
    keys.length < 3 ||
    keys[0] !== 'spec' ||
    !ALLOWED_OVERRIDE_CATEGORIES[targetKind].has(keys[1])
  ) {
    throw new Error(`Invalid pointer: '${pointer}'`);
  }
  let current = doc;
  for (const key of keys.slice(0, -1)) {
    if (
      current[key] === null ||
      current[key] === undefined ||
      typeof current[key] !== 'object'
    ) {
      current[key] = {};
    }
    current = current[key];
  }
  const last = keys.at(-1)!;
  current[last] = value;
}

export function applyEnvChange(doc: any, key: string, value: string): void {
  const env: { key: string; value: string }[] =
    doc.spec?.workloadOverrides?.container?.env ?? [];
  const existing = env.find(e => e.key === key);
  if (existing) {
    existing.value = value;
  } else {
    env.push({ key, value });
    doc.spec ??= {};
    doc.spec.workloadOverrides ??= {};
    doc.spec.workloadOverrides.container ??= {};
    doc.spec.workloadOverrides.container.env = env;
  }
}

export function applyFileChange(
  doc: any,
  key: string,
  mountPath: string,
  value: string,
): void {
  const files: { key: string; value: string; mountPath: string }[] =
    doc.spec?.workloadOverrides?.container?.files ?? [];
  const existing = files.find(f => f.key === key && f.mountPath === mountPath);
  if (existing) {
    existing.value = value;
  } else {
    throw new Error(
      `File mount '${key}' at '${mountPath}' not found in binding`,
    );
  }
}

/**
 * GET a release binding, apply the given changes, and PUT it back.
 * Used by the finops apply button for deterministic field-only patches
 * (no user-editable overrides).
 */
export async function applyResourceChange(opts: {
  backendBaseUrl: string;
  fetchApi: FetchApi;
  namespaceName: string;
  change: ResourceChangeDef;
}): Promise<void> {
  const { backendBaseUrl, fetchApi, namespaceName, change } = opts;

  const targetKind = resolveTargetKind(change);
  const label = bindingLabel(targetKind);

  if (
    targetKind === 'ResourceReleaseBinding' &&
    ((change.env?.length ?? 0) > 0 || (change.files?.length ?? 0) > 0)
  ) {
    throw new Error(
      'ResourceReleaseBinding changes support only field updates under /spec/resourceTypeEnvironmentConfigs',
    );
  }

  const bindingUrl = `${backendBaseUrl}/${bindingEndpoint(
    targetKind,
  )}?namespaceName=${encodeURIComponent(
    namespaceName,
  )}&bindingName=${encodeURIComponent(change.release_binding)}`;

  const getResponse = await fetchApi.fetch(bindingUrl);
  if (!getResponse.ok) {
    const detail =
      getResponse.status === 404
        ? `Not found: ${label} '${change.release_binding}'`
        : `Failed to get ${label}: ${getResponse.statusText}`;
    throw new Error(detail);
  }

  const binding = await getResponse.json();
  const updated = structuredClone(binding);

  for (const e of change.env ?? []) {
    applyEnvChange(updated, e.key, e.value);
  }
  for (const f of change.files ?? []) {
    applyFileChange(updated, f.key, f.mount_path, f.value);
  }
  for (const f of change.fields ?? []) {
    applyJsonPointer(updated, f.json_pointer, f.value, targetKind);
  }

  const putResponse = await fetchApi.fetch(bindingUrl, {
    method: 'PUT',
    body: JSON.stringify({ metadata: updated.metadata, spec: updated.spec }),
    headers: { 'Content-Type': 'application/json' },
  });

  if (!putResponse.ok) {
    throw new Error(`Failed to update ${label}: ${putResponse.statusText}`);
  }
}
