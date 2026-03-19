import { useState, useEffect } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';

/**
 * Fetches the ttlAfterCompletion from the Workflow or ClusterWorkflow catalog entity.
 */
export function useWorkflowRetention(
  workflowName?: string,
  workflowKind?: 'Workflow' | 'ClusterWorkflow',
  namespace?: string,
): string | undefined {
  const catalogApi = useApi(catalogApiRef);
  const [ttl, setTtl] = useState<string | undefined>();

  useEffect(() => {
    if (!workflowName || !workflowKind) {
      setTtl(undefined);
      return undefined;
    }

    let ignore = false;

    const fetchTtl = async () => {
      try {
        const entityNamespace =
          workflowKind === 'ClusterWorkflow' ? 'openchoreo-cluster' : namespace;

        if (!entityNamespace) {
          return;
        }

        const entity = await catalogApi.getEntityByRef(
          `${workflowKind.toLowerCase()}:${entityNamespace}/${workflowName}`,
        );

        if (!ignore && entity) {
          const spec = entity.spec as Record<string, unknown> | undefined;
          const value = spec?.ttlAfterCompletion as string | undefined;
          setTtl(value);
        }
      } catch {
        // Entity may not exist in catalog yet — ignore
      }
    };

    fetchTtl();

    return () => {
      ignore = true;
    };
  }, [catalogApi, workflowName, workflowKind, namespace]);

  return ttl;
}

/**
 * Formats a duration string like "10d1h30m" into a human-readable form like "10 days".
 * For simple cases, returns a concise label.
 */
export function formatRetentionDuration(duration: string): string {
  const dayMatch = duration.match(/(\d+)\s*d/);
  const hourMatch = duration.match(/(\d+)\s*h/);
  const minMatch = duration.match(/(\d+)\s*m/);

  const days = dayMatch ? parseInt(dayMatch[1], 10) : 0;
  const hours = hourMatch ? parseInt(hourMatch[1], 10) : 0;
  const minutes = minMatch ? parseInt(minMatch[1], 10) : 0;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  if (minutes > 0 && days === 0)
    parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);

  return parts.length > 0 ? parts.join(' ') : duration;
}
