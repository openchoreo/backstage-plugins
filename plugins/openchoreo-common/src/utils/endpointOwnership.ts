/** The owner of an OpenChoreo Endpoint, its `spec.owner`. */
export interface EndpointOwner {
  projectName?: string;
  componentName?: string;
  releaseLineName?: string;
}

/**
 * Returns the component that owns an Endpoint, or undefined when its project
 * owns it.
 *
 * The API keeps the owner honest: when an update routes a backend to another
 * component, it clears `componentName`, so the Endpoint belongs to its
 * project again.
 */
export function endpointManagingComponent(
  owner: EndpointOwner | undefined,
): string | undefined {
  return owner?.componentName || undefined;
}

/**
 * Returns the line of its owning component an Endpoint belongs to: the
 * release line in `releaseLineName`, or '' for the component's main line.
 * Undefined when no component owns the Endpoint.
 *
 * When an update routes a backend to another line, the API clears
 * `releaseLineName`, so a line's Endpoint that starts routing to main moves
 * to the main line. A main-line Endpoint that adds a backend on a release
 * line, as for a canary, stays the main line's.
 */
export function endpointManagingReleaseLine(
  owner: EndpointOwner | undefined,
): string | undefined {
  if (!endpointManagingComponent(owner)) return undefined;
  return owner?.releaseLineName || '';
}
