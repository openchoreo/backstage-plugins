import type { ResourceTreeData } from '../types';
import type { TreeNode } from './treeTypes';

/**
 * Extracts the names of a Pod's regular (exec-attachable) containers from its
 * full K8s object (`node.specObject`); returns [] when unavailable.
 *
 * Init containers are excluded — they're typically already terminated once the
 * pod is running, so exec-ing into one would target an unattachable container.
 */
export function getPodContainerNames(
  specObject: Record<string, unknown> | undefined,
): string[] {
  const spec = (specObject as any)?.spec;
  if (!spec) return [];
  const names: string[] = [];
  const list = spec.containers;
  if (Array.isArray(list)) {
    for (const c of list) {
      if (c?.name && typeof c.name === 'string') names.push(c.name);
    }
  }
  return names;
}

/**
 * True when the rendered resource tree contains at least one Pod node — i.e.
 * the workload pod is OpenChoreo-managed and surfaced in the tree, so the
 * Terminal can be offered on the Pod node's drawer. When false, the pod is
 * managed elsewhere (another operator) and the fallback path applies.
 *
 * Uses data already fetched for the tree — no extra API call / resource.
 */
export function treeHasPodNode(
  resourceTreeData: ResourceTreeData | undefined,
  treeNodes?: TreeNode[],
): boolean {
  if (treeNodes && treeNodes.some(n => n.kind === 'Pod')) return true;
  const releases = resourceTreeData?.renderedReleases ?? [];
  return releases.some(r => (r.nodes ?? []).some(n => n.kind === 'Pod'));
}
