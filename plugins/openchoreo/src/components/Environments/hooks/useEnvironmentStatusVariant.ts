import type { StatusType } from '@openchoreo/backstage-design-system';

export interface EnvironmentStatusVariant {
  variant: StatusType;
  label: string;
}

export function useEnvironmentStatusVariant(
  status?: 'Ready' | 'NotReady' | 'Failed',
  statusReason?: string,
): EnvironmentStatusVariant {
  if (statusReason === 'ResourcesUndeployed') {
    return { variant: 'undeployed', label: 'Undeployed' };
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
