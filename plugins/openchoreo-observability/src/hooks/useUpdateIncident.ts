import { useApi } from '@backstage/core-plugin-api';
import { useOpenChoreoMutation } from '@openchoreo/backstage-plugin-react';
import { observabilityApiRef } from '../api';
import type { IncidentSummary } from '../types';

export interface UseUpdateIncidentResult {
  updateIncident: (
    incident: IncidentSummary,
    newStatus: 'acknowledged' | 'resolved',
  ) => Promise<void>;
  updating: boolean;
  error: string | null;
  clearError: () => void;
}

export function useUpdateIncident(): UseUpdateIncidentResult {
  const observabilityApi = useApi(observabilityApiRef);

  const { mutate, isLoading, error, reset } = useOpenChoreoMutation(
    async (
      incident: IncidentSummary,
      newStatus: 'acknowledged' | 'resolved',
    ) => {
      const namespaceName = incident.namespaceName || '';
      const environmentName = incident.environmentName || '';
      if (!namespaceName || !environmentName) {
        throw new Error(
          'Cannot update incident: missing namespace or environment.',
        );
      }
      await observabilityApi.updateIncidentStatus(
        incident.incidentId,
        newStatus,
        namespaceName,
        environmentName,
      );
    },
    // Refresh any incident lists so the new status shows without a manual refetch.
    { invalidates: [['project-incidents'], ['incidents-summary']] },
  );

  return {
    updateIncident: async (incident, newStatus) => {
      await mutate(incident, newStatus);
    },
    updating: isLoading,
    error: error ? error.message || 'Failed to update incident.' : null,
    clearError: reset,
  };
}
