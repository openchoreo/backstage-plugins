/**
 * Shared utilities for parsing and comparing OpenChoreo capability paths.
 *
 * Path format: "ns/{namespaceName}/project/{projectName}/component/{componentName}"
 * Wildcards: "*" at any segment means "match everything at this level and below".
 */

export interface ParsedPath {
  namespace?: string;
  project?: string;
  component?: string;
}

/**
 * Regex that validates the full path grammar.
 *
 * Valid forms:
 * - "*"
 * - "ns/{name}" optionally followed by "/project/{name}" optionally followed by "/component/{name}"
 *
 * Each {name} is one or more non-slash characters (including "*" for wildcards).
 */
const PATH_REGEX =
  /^ns\/([^/]+)(?:\/project\/([^/]+)(?:\/component\/([^/]+))?)?$/;

/**
 * Parses a capability path from the backend format.
 *
 * Only accepts fully valid paths:
 * - "*" (global wildcard)
 * - "ns/{name}" (namespace level)
 * - "ns/{name}/project/{name}" (project level)
 * - "ns/{name}/project/{name}/component/{name}" (component level)
 *
 * Returns null for any input that does not match the grammar.
 * Undefined fields mean that level was not specified in the path.
 */
export function parseCapabilityPath(path: string): ParsedPath | null {
  if (path === '*') {
    return { namespace: '*', project: '*', component: '*' };
  }

  const match = path.match(PATH_REGEX);
  if (!match) {
    return null;
  }

  const result: ParsedPath = { namespace: match[1] };
  if (match[2] !== undefined) {
    result.project = match[2];
  }
  if (match[3] !== undefined) {
    result.component = match[3];
  }

  return result;
}

/**
 * Checks if a deny path fully covers (is equal to or broader than) an allow path.
 *
 * "Covers" means every scope that would match the allow path also matches the deny path.
 * A deny covers an allow when the deny is at the same or broader scope.
 *
 * At each hierarchy level (namespace → project → component):
 * - deny undefined or "*" → covers everything at this level and below → covered
 * - deny has specific value, allow undefined or "*" → allow is broader → NOT covered
 * - both specific → must be equal to continue checking deeper levels
 *
 * @example
 * isPathCoveredBy("ns/acme/*", "*") // true — global deny covers everything
 * isPathCoveredBy("ns/acme/*", "ns/acme/*") // true — same scope
 * isPathCoveredBy("ns/acme/project/foo/*", "ns/acme/*") // true — broader deny
 * isPathCoveredBy("ns/acme/*", "ns/acme/project/secret/*") // false — narrower deny
 * isPathCoveredBy("ns/acme/*", "ns/other/*") // false — different namespace
 */
export function isPathCoveredBy(allowPath: string, denyPath: string): boolean {
  if (denyPath === '*') {
    return true;
  }

  const allow = parseCapabilityPath(allowPath);
  const deny = parseCapabilityPath(denyPath);

  // Invalid paths cannot cover or be covered
  if (!allow || !deny) {
    return false;
  }

  // Check each hierarchy level: namespace → project → component
  const levels: (keyof ParsedPath)[] = ['namespace', 'project', 'component'];

  for (const level of levels) {
    const denyVal = deny[level];
    const allowVal = allow[level];

    // Deny undefined or "*" at this level means it covers everything below
    if (!denyVal || denyVal === '*') {
      return true;
    }

    // Deny has a specific value but allow is undefined or "*" (broader) → not covered
    if (!allowVal || allowVal === '*') {
      return false;
    }

    // Both have specific values — must be equal to continue
    if (denyVal !== allowVal) {
      return false;
    }
  }

  // All levels matched exactly
  return true;
}

/**
 * Checks if at least one allowed path is not fully covered by any deny path.
 *
 * Used for basic (non-resource) permission checks where there's no entity context.
 * Returns true if the user has at least some scope where they're allowed.
 *
 * @param allowedPaths - Allowed paths from user's capabilities
 * @param deniedPaths - Denied paths from user's capabilities
 * @returns true if at least one allowed path is not covered by any deny
 */
export function hasUncoveredAllowedPath(
  allowedPaths: string[],
  deniedPaths: string[],
): boolean {
  if (allowedPaths.length === 0) {
    return false;
  }
  if (deniedPaths.length === 0) {
    return true;
  }
  return allowedPaths.some(
    ap => !deniedPaths.some(dp => isPathCoveredBy(ap, dp)),
  );
}
