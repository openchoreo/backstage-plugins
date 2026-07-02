import type { StatusType } from '@openchoreo/backstage-design-system';
import type { ProjectEnvironment } from '../../api/OpenChoreoClientApi';

/**
 * Maps a ProjectEnvironment's binding state to a StatusBadge variant.
 * Shared by the canvas tile and the detail panel header so the same
 * env always renders the same badge in both places.
 */
export function deriveProjectEnvBadgeStatus(
  env: ProjectEnvironment,
): StatusType {
  if (!env.bindingName) return 'not-deployed';
  if (env.status === 'Ready') return 'active';
  if (env.status === 'Failed') return 'failed';
  if (env.status === 'NotReady') return 'pending';
  return 'unknown';
}
