import type { FetchApi } from '@backstage/core-plugin-api';

type PrimitiveValue = string | number | boolean;

export interface FieldChangeDef {
  json_pointer: string;
  value: PrimitiveValue;
}

export interface ResourceChangeDef {
  release_binding: string;
  fields?: FieldChangeDef[];
  env?: Array<{ key: string; value: string }>;
  files?: Array<{ key: string; mount_path: string; value: string }>;
}

const ALLOWED_OVERRIDE_CATEGORIES = new Set([
  'workloadOverrides',
  'traitEnvironmentConfigs',
  'componentTypeEnvironmentConfigs',
]);

export function applyJsonPointer(doc: any, pointer: string, value: any): void {
  const keys = pointer.replace(/^\//, '').split('/');
  if (
    keys.length < 3 ||
    keys[0] !== 'spec' ||
    !ALLOWED_OVERRIDE_CATEGORIES.has(keys[1])
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

  const bindingUrl = `${backendBaseUrl}/release-binding?namespaceName=${encodeURIComponent(
    namespaceName,
  )}&bindingName=${encodeURIComponent(change.release_binding)}`;

  const getResponse = await fetchApi.fetch(bindingUrl);
  if (!getResponse.ok) {
    const detail =
      getResponse.status === 404
        ? `Release binding '${change.release_binding}' not found`
        : `Failed to get release binding: ${getResponse.statusText}`;
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
    applyJsonPointer(updated, f.json_pointer, f.value);
  }

  const putResponse = await fetchApi.fetch(bindingUrl, {
    method: 'PUT',
    body: JSON.stringify({ metadata: updated.metadata, spec: updated.spec }),
    headers: { 'Content-Type': 'application/json' },
  });

  if (!putResponse.ok) {
    throw new Error(
      `Failed to update release binding: ${putResponse.statusText}`,
    );
  }
}
