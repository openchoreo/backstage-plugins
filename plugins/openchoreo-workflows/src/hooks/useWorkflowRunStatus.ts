import { useEffect, useRef, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { genericWorkflowsClientApiRef } from '../api';
import { useSelectedNamespace } from '../context';
import type { WorkflowStepStatus } from '../types';

const TERMINAL_STATUSES = ['completed', 'failed', 'succeeded', 'error'];

export const isTerminalStatus = (status?: string) =>
  status ? TERMINAL_STATUSES.includes(status.toLowerCase()) : false;

interface WorkflowRunStatusState {
  status: string;
  steps: WorkflowStepStatus[];
  hasLiveObservability: boolean;
}

/**
 * Polls workflow run status and auto-selects the initial step.
 * @param runName - the workflow run name
 * @param observabilityErrorMessage - message shown when observability is not configured
 */
export function useWorkflowRunStatus(
  runName: string,
  observabilityErrorMessage: string,
) {
  const client = useApi(genericWorkflowsClientApiRef);
  const namespaceName = useSelectedNamespace();

  const [statusState, setStatusState] = useState<WorkflowRunStatusState | null>(
    null,
  );
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isObservabilityNotConfigured, setIsObservabilityNotConfigured] =
    useState(false);
  const [activeStepName, setActiveStepName] = useState<string | null>(null);

  const hasAutoSelectedStepRef = useRef(false);

  // Reset per-run state when the viewed run or namespace changes
  useEffect(() => {
    hasAutoSelectedStepRef.current = false;
    setActiveStepName(null);
    setIsObservabilityNotConfigured(false);
  }, [namespaceName, runName]);

  useEffect(() => {
    if (!namespaceName || !runName) return;

    let cancelled = false;
    let intervalId: number | undefined;

    const fetchStatus = async () => {
      try {
        if (!cancelled) {
          setStatusLoading(true);
          setStatusError(null);
        }

        const data = await client.getWorkflowRunStatus(namespaceName, runName);

        if (cancelled) return;

        setStatusState(data);

        // Auto-select initial step only once
        if (
          !hasAutoSelectedStepRef.current &&
          data.steps &&
          data.steps.length > 0
        ) {
          const runningStep = data.steps.find(
            step => step.phase?.toLowerCase() === 'running',
          );
          const defaultStep =
            isTerminalStatus(data.status) || !runningStep
              ? data.steps[data.steps.length - 1]
              : runningStep;

          if (defaultStep?.name) {
            setActiveStepName(defaultStep.name);
            hasAutoSelectedStepRef.current = true;
          }
        }

        // Stop polling once workflow reaches a terminal state
        if (isTerminalStatus(data.status) && intervalId !== undefined) {
          window.clearInterval(intervalId);
          intervalId = undefined;
        }
      } catch (err) {
        if (cancelled) return;
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch run status';

        if (
          errorMessage.includes('ObservabilityNotConfigured') ||
          errorMessage.includes('OBSERVABILITY_NOT_CONFIGURED')
        ) {
          setIsObservabilityNotConfigured(true);
          setStatusError(observabilityErrorMessage);
        } else {
          setStatusError(errorMessage);
        }
      } finally {
        if (!cancelled) {
          setStatusLoading(false);
        }
      }
    };

    fetchStatus();
    intervalId = window.setInterval(fetchStatus, 10_000);

    return () => {
      cancelled = true;
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, namespaceName, runName]);

  return {
    statusState,
    statusLoading,
    statusError,
    isObservabilityNotConfigured,
    activeStepName,
    setActiveStepName,
  };
}
