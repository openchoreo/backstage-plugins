import type { TreeNode } from './treeTypes';

const INVENTORY_KINDS = [
  'Deployment',
  'StatefulSet',
  'DaemonSet',
  'ReplicaSet',
  'Job',
  'Pod',
  'PersistentVolumeClaim',
] as const;

export interface FluxInventoryRef {
  namespace: string;
  name: string;
  kind: string;
  group?: string;
}

/**
 * Parse Flux helm-controller inventory entry IDs.
 *
 * Examples:
 *   obt-dev_smollm2_apps_Deployment
 *   obt-dev_smollm2-model-storage__PersistentVolumeClaim
 */
export function parseFluxHelmInventoryEntryId(
  id: string,
): FluxInventoryRef | undefined {
  const trimmed = id.trim();
  if (!trimmed) {
    return undefined;
  }

  for (const kind of INVENTORY_KINDS) {
    const suffix = kind === 'PersistentVolumeClaim' ? `__${kind}` : `_${kind}`;
    if (!trimmed.endsWith(suffix)) {
      continue;
    }
    const prefix = trimmed.slice(0, -suffix.length);
    if (kind === 'PersistentVolumeClaim') {
      const splitAt = prefix.indexOf('_');
      if (splitAt <= 0) {
        return undefined;
      }
      return {
        namespace: prefix.slice(0, splitAt),
        name: prefix.slice(splitAt + 1),
        kind,
      };
    }

    const groupSplit = prefix.lastIndexOf('_');
    if (groupSplit <= 0) {
      return undefined;
    }
    const group = prefix.slice(groupSplit + 1);
    const nsName = prefix.slice(0, groupSplit);
    const nsSplit = nsName.indexOf('_');
    if (nsSplit <= 0) {
      return undefined;
    }
    return {
      namespace: nsName.slice(0, nsSplit),
      name: nsName.slice(nsSplit + 1),
      kind,
      group: group || undefined,
    };
  }

  return undefined;
}

function resourceKey(kind: string, name: string, namespace?: string): string {
  return `${namespace ?? ''}/${kind}/${name}`;
}

/**
 * Nest workload nodes under their HelmRelease using Flux inventory entries.
 * Fixes flat trees where Deployments hang under RenderedRelease because
 * openchoreo-api omitted parentRefs on inventory workloads.
 */
export function nestHelmReleaseChildren(
  nodes: TreeNode[],
  releaseNodeId: string,
): void {
  const helmReleases = nodes.filter(n => n.kind === 'HelmRelease');
  if (helmReleases.length === 0) {
    return;
  }

  for (const hr of helmReleases) {
    const inventoryKeys = new Set<string>();
    const entries =
      (
        hr.specObject as
          | { status?: { inventory?: { entries?: Array<{ id?: string }> } } }
          | undefined
      )?.status?.inventory?.entries ?? [];

    for (const entry of entries) {
      const parsed = parseFluxHelmInventoryEntryId(String(entry?.id || ''));
      if (!parsed?.kind || !parsed?.name) {
        continue;
      }
      inventoryKeys.add(
        resourceKey(parsed.kind, parsed.name, parsed.namespace),
      );
    }

    for (const node of nodes) {
      if (node.id === hr.id || node.isRoot || node.kind === 'RenderedRelease') {
        continue;
      }

      const key = resourceKey(node.kind, node.name, node.namespace);
      const listedInInventory = inventoryKeys.has(key);
      const onlyUnderRelease =
        node.parentIds.length === 1 && node.parentIds[0] === releaseNodeId;
      const alreadyUnderHr = node.parentIds.includes(hr.id);

      if (listedInInventory && !alreadyUnderHr) {
        node.parentIds = [hr.id];
        continue;
      }

      if (
        onlyUnderRelease &&
        helmReleases.length === 1 &&
        (node.kind === 'Deployment' ||
          node.kind === 'StatefulSet' ||
          node.kind === 'DaemonSet' ||
          node.kind === 'PersistentVolumeClaim') &&
        !alreadyUnderHr
      ) {
        node.parentIds = [hr.id];
      }
    }
  }
}
