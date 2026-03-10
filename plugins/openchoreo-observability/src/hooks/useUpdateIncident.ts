import { useState, useCallback, useRef } from 'react';
import { useApi } from '@backstage/core-plugin-api';
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
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const updateIncident = useCallback(
    async (
      incident: IncidentSummary,
      newStatus: 'acknowledged' | 'resolved',
    ): Promise<void> => {
      if (inFlightRef.current) return;

      const namespaceName = incident.namespaceName || '';
      const environmentName = incident.environmentName || '';

      if (!namespaceName || !environmentName) {
        setError('Cannot update incident: missing namespace or environment.');
        return;
      }

      inFlightRef.current = true;
      setUpdating(true);
      setError(null);

      try {
        await observabilityApi.updateIncidentStatus(
          incident.incidentId,
          newStatus,
          namespaceName,
          environmentName,
        );
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Failed to update incident.';
        setError(msg);
        throw err; // re-throw so the caller can skip refresh on failure
      } finally {
        setUpdating(false);
        inFlightRef.current = false;
      }
    },
    [observabilityApi],
  );

  const clearError = useCallback(() => setError(null), []);

  return { updateIncident, updating, error, clearError };
}
