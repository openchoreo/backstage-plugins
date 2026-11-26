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
 * The profile entries that apply to `action`: its own, and `*`, the single
 * entry a control plane with authorization turned off returns. OpenChoreo
 * expands wildcard actions in roles before building the profile, so no
 * other wildcard key appears.
 */
function entriesFor(
  capabilities: Record<string, ActionCapability>,
  action: string,
): ActionCapability[] {
  return [action, '*']
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

/**
 * Whether a profile may grant `action` on the one resource at
 * `resourcePath`: a grant covers it, possibly under CEL constraints the
 * profile can't evaluate, and no unconditional denial does. Suits a single
 * read, whose response settles what the constraints allow; a list needs
 * `grantsUnconditionally`.
 */
export function mayGrant(
  capabilities: Record<string, ActionCapability>,
  action: string,
  resourcePath: string,
): boolean {
  const entries = entriesFor(capabilities, action);
  const allowed = entries.some(entry =>
    (entry.allowed ?? []).some(resource => covers(resource.path, resourcePath)),
  );
  const denied = entries.some(entry =>
    (entry.denied ?? []).some(
      resource =>
        covers(resource.path, resourcePath) &&
        !resource.constraints?.expressions?.length,
    ),
  );
  return allowed && !denied;
}

/**
 * The authz path of a namespace. OpenChoreo authorizes namespace-scoped
 * resources such as environments against this path, not one per resource.
 */
export function namespacePath(namespaceName: string): string {
  return `ns/${namespaceName}`;
}

/**
 * The authz path of a project. OpenChoreo authorizes Endpoints and their
 * release bindings against this path, not one per component.
 */
export function projectPath(
  namespaceName: string,
  projectName: string,
): string {
  return `${namespacePath(namespaceName)}/project/${projectName}`;
}

/**
 * The authz path of a component, as OpenChoreo builds it
 * (`resourceHierarchyToPath` in internal/authz/casbin/helpers.go).
 */
export function componentPath(
  namespaceName: string,
  projectName: string,
  componentName: string,
): string {
  return `${namespacePath(
    namespaceName,
  )}/project/${projectName}/component/${componentName}`;
}
