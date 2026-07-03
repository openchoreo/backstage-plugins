import type { StatusType } from '@openchoreo/backstage-design-system';

export interface EnvironmentStatusVariant {
  variant: StatusType;
  label: string;
}

// Pure classifier shared by the hook and by non-render callers (e.g. default
// selection resolution). Keep this as the single source of truth so card
// display and selection logic can never drift apart.
export function getEnvironmentStatusVariant(
  status?: 'Ready' | 'NotReady' | 'Failed',
  statusReason?: string,
): EnvironmentStatusVariant {
  if (statusReason === 'ResourcesUndeployed') {
    return { variant: 'undeployed', label: 'Undeployed' };
  }
  // A Ready binding whose primary workload is scaled to zero. Core reports this
  // on the ResourcesReady condition; the backend surfaces its reason here so the
  // pipeline shows "Suspended" rather than "Active".
  if (statusReason === 'ReadyWithSuspendedResources') {
    return { variant: 'suspended', label: 'Suspended' };
  }
  if (status === 'Ready') {
    return { variant: 'active', label: 'Active' };
  }
  if (status === 'NotReady') {
    return { variant: 'pending', label: 'Pending' };
  }
  if (status === 'Failed') {
    return { variant: 'failed', label: 'Failed' };
  }
  return { variant: 'not-deployed', label: 'Not Deployed' };
}

export function useEnvironmentStatusVariant(
  status?: 'Ready' | 'NotReady' | 'Failed',
  statusReason?: string,
): EnvironmentStatusVariant {
  return getEnvironmentStatusVariant(status, statusReason);
}
