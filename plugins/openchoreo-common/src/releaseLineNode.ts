// '@' is not valid in Kubernetes names, so a line node id never clashes with
// a component name, and it avoids the ':' and '|' the cell diagram splits on.
const SEPARATOR = '@';

/** Cell diagram node id for one release line of a component. */
export function releaseLineNodeId(
  componentName: string,
  releaseLine: string,
): string {
  return `${componentName}${SEPARATOR}${releaseLine}`;
}

/** Splits a cell diagram node id into its component and release line. */
export function parseReleaseLineNodeId(nodeId: string): {
  componentName: string;
  releaseLine?: string;
} {
  const index = nodeId.indexOf(SEPARATOR);
  if (index < 0) return { componentName: nodeId };
  return {
    componentName: nodeId.slice(0, index),
    releaseLine: nodeId.slice(index + 1),
  };
}
