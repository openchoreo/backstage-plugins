import type { PendingAction } from './types';

/**
 * Serialize a PendingAction to URLSearchParams
 */
export function serializePendingAction(action: PendingAction): URLSearchParams {
  const params = new URLSearchParams();
  params.set('action', action.type);
  params.set('release', action.releaseName);
  params.set('target', action.targetEnvironment);

  if (action.type === 'promote') {
    params.set('source', action.sourceEnvironment);
  }

  return params;
}

/**
 * Deserialize a PendingAction from URLSearchParams
 */
export function deserializePendingAction(
  params: URLSearchParams,
): PendingAction | undefined {
  const type = params.get('action');
  const releaseName = params.get('release');
  const targetEnvironment = params.get('target');

  if (!type || !releaseName || !targetEnvironment) {
    return undefined;
  }

  if (type === 'deploy') {
    return { type: 'deploy', releaseName, targetEnvironment };
  }

  if (type === 'promote') {
    const sourceEnvironment = params.get('source');
    if (!sourceEnvironment) return undefined;
    return {
      type: 'promote',
      releaseName,
      sourceEnvironment,
      targetEnvironment,
    };
  }

  return undefined;
}
