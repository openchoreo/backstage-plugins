import { Entity } from '@backstage/catalog-model';
import type { PendingAction, RunDetailsTab, WorkflowTab } from './types';
import { serializePendingAction } from './pendingAction';

/**
 * Build entity base path: /catalog/{namespace}/{kind}/{name}
 */
export function buildEntityPath(entity: Entity): string {
  const namespace = entity.metadata.namespace || 'default';
  const kind = entity.kind.toLowerCase();
  const name = entity.metadata.name;
  return `/catalog/${namespace}/${kind}/${name}`;
}

/**
 * Build environments base path for an entity
 */
export function buildEnvironmentsBasePath(entity: Entity): string {
  return `${buildEntityPath(entity)}/environments`;
}

/**
 * Build workflows base path for an entity
 */
export function buildWorkflowsBasePath(entity: Entity): string {
  return `${buildEntityPath(entity)}/workflows`;
}

/**
 * Build runtime-logs base path for an entity
 */
export function buildRuntimeLogsBasePath(entity: Entity): string {
  return `${buildEntityPath(entity)}/runtime-logs`;
}

// --- Environment Paths ---

/**
 * Build path to environment overrides page
 */
export function buildOverridesPath(
  basePath: string,
  envName: string,
  pendingAction?: PendingAction,
): string {
  const encodedEnv = encodeURIComponent(envName.toLowerCase());
  let url = `${basePath}/overrides/${encodedEnv}`;
  if (pendingAction) {
    url += `?${serializePendingAction(pendingAction).toString()}`;
  }
  return url;
}

/**
 * Build path to release details page
 */
export function buildReleaseDetailsPath(
  basePath: string,
  envName: string,
): string {
  const encodedEnv = encodeURIComponent(envName.toLowerCase());
  return `${basePath}/release/${encodedEnv}`;
}

/**
 * Build path to workload config page
 */
export function buildWorkloadConfigPath(basePath: string): string {
  return `${basePath}/workload-config`;
}

/**
 * Build path to overrides page with specific tab
 */
export function buildOverridesPathWithTab(
  basePath: string,
  envName: string,
  tabId: string,
): string {
  const encodedEnv = encodeURIComponent(envName.toLowerCase());
  return `${basePath}/overrides/${encodedEnv}?tab=${encodeURIComponent(tabId)}`;
}

// --- Workflow Paths ---

/**
 * Build path to workflow run details
 */
export function buildWorkflowRunPath(
  basePath: string,
  runId: string,
  tab?: RunDetailsTab,
): string {
  const encodedRunId = encodeURIComponent(runId);
  const query = tab && tab !== 'logs' ? `?tab=${tab}` : '';
  return `${basePath}/run/${encodedRunId}${query}`;
}

/**
 * Build path to workflow config page
 */
export function buildWorkflowConfigPath(basePath: string): string {
  return `${basePath}/config`;
}

/**
 * Build path to workflow list with specific tab
 */
export function buildWorkflowListPath(
  basePath: string,
  tab?: WorkflowTab,
): string {
  if (tab && tab !== 'runs') {
    return `${basePath}?tab=${tab}`;
  }
  return basePath;
}
