/** One action's entry in an OpenChoreo authz profile. */
export interface ActionCapability {
  allowed?: CapabilityResource[];
  denied?: CapabilityResource[];
}

interface CapabilityResource {
  path?: string;
  constraints?: { expressions?: string[] };
}

/**
 * The profile entries that apply to `action`: its own, its `<kind>:*`
 * wildcard, and `*`, the single entry a control plane with authorization
 * turned off returns.
 */
function entriesFor(
  capabilities: Record<string, ActionCapability>,
  action: string,
): ActionCapability[] {
  const [kind] = action.split(':');
  return [action, `${kind}:*`, '*']
    .map(key => capabilities[key])
    .filter((entry): entry is ActionCapability => Boolean(entry));
}

/**
 * Whether a policy path applies to a resource path, the way OpenChoreo
 * matches them: `*`, the path itself, or one of its ancestors.
 */
function covers(policyPath: string | undefined, resourcePath: string) {
  if (!policyPath) return false;
  return (
    policyPath === '*' ||
    policyPath === resourcePath ||
    resourcePath.startsWith(`${policyPath}/`)
  );
}

function overlaps(policyPath: string | undefined, resourcePath: string) {
  return (
    covers(policyPath, resourcePath) ||
    Boolean(policyPath?.startsWith(`${resourcePath}/`))
  );
}

/**
 * Whether a profile grants `action` on everything under `resourcePath`
 * without conditions. A list request returns only what the caller may see,
 * so a grant with CEL constraints, or any denial at, above or below the
 * path, means a list can come back incomplete without saying so.
 */
export function grantsUnconditionally(
  capabilities: Record<string, ActionCapability>,
  action: string,
  resourcePath: string,
): boolean {
  const entries = entriesFor(capabilities, action);
  const allowed = entries.some(entry =>
    (entry.allowed ?? []).some(
      resource =>
        covers(resource.path, resourcePath) &&
        !resource.constraints?.expressions?.length,
    ),
  );
  const denied = entries.some(entry =>
    (entry.denied ?? []).some(resource =>
      overlaps(resource.path, resourcePath),
    ),
  );
  return allowed && !denied;
}

/** The authz path of a component, as OpenChoreo builds it. */
export function componentPath(
  namespaceName: string,
  projectName: string,
  componentName: string,
): string {
  return `namespace/${namespaceName}/project/${projectName}/component/${componentName}`;
}
