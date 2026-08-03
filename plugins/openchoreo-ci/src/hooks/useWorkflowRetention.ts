import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';

/**
 * Fetches the ttlAfterCompletion from the Workflow or ClusterWorkflow catalog entity.
 */
export function useWorkflowRetention(
  workflowName?: string,
  workflowKind?: 'Workflow' | 'ClusterWorkflow',
  namespace?: string,
): string | undefined {
  const catalogApi = useApi(catalogApiRef);

  const entityNamespace =
    workflowKind === 'ClusterWorkflow' ? 'openchoreo-cluster' : namespace;

  const enabled = !!workflowName && !!workflowKind && !!entityNamespace;

  const { data } = useOpenChoreoQuery<string | undefined>(
    ['workflow-retention', workflowKind, entityNamespace, workflowName],
    async () => {
      const entity = await catalogApi.getEntityByRef(
        `${workflowKind!.toLowerCase()}:${entityNamespace}/${workflowName}`,
      );
      const spec = entity?.spec as Record<string, unknown> | undefined;
      return (spec?.ttlAfterCompletion as string) ?? undefined;
    },
    { enabled },
  );

  return data ?? undefined;
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
