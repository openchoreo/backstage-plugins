import { useMemo, type FC } from 'react';
import { Typography } from '@material-ui/core';
import { StatusBadge } from '@openchoreo/backstage-design-system';
import { useTreeStyles } from './treeStyles';
import { getResourceTreeNodes } from './treeLayoutUtils';
import { getHealthStatusForTab, formatTimestamp } from '../utils';
import type { ReleaseData, ResourceTreeData, HealthStatus, ResourceTreeNode } from '../types';

function getReadyCondition(releaseData: ReleaseData) {
  const conditions = releaseData.data?.status?.conditions;
  if (!conditions) return undefined;
  return conditions.find(c => c.type === 'Ready');
}

function getOverallHealth(
  releaseData: ReleaseData,
  releaseBindingData?: Record<string, unknown> | null,
): { label: string; status: HealthStatus; reason?: string } {
  // Prefer ReleaseBinding status (matches tree root node logic)
  if (releaseBindingData) {
    if (typeof releaseBindingData.status === 'string') {
      const flatStatus = releaseBindingData.status;
      if (flatStatus === 'Ready') return { label: 'Healthy', status: 'Healthy' };
      if (flatStatus === 'Failed') return { label: 'Degraded', status: 'Degraded' };
      if (flatStatus === 'NotReady') return { label: 'Progressing', status: 'Progressing' };
    } else {
      const bindingStatus = releaseBindingData.status as Record<string, unknown> | undefined;
      const bindingConditions = Array.isArray(bindingStatus?.conditions) ? bindingStatus.conditions : [];
      const readyCondition = bindingConditions.find((c: any) => c.type === 'Ready');
      if (readyCondition) {
        const condStatus = (readyCondition as any).status;
        const reason = (readyCondition as any).reason as string | undefined;
        if (condStatus === 'True') return { label: 'Healthy', status: 'Healthy', reason };
        if (condStatus === 'False') return { label: 'Degraded', status: 'Degraded', reason };
        return { label: 'Progressing', status: 'Progressing', reason };
      }
    }
  }

  // Fallback to release conditions
  const ready = getReadyCondition(releaseData);
  if (!ready) {
    return { label: 'Unknown', status: 'Unknown' };
  }
  const isReady = ready.status === 'True';
  return {
    label: isReady ? 'Healthy' : 'Degraded',
    status: isReady ? 'Healthy' : 'Degraded',
    reason: ready.reason,
  };
}

function getResourceCounts(nodes: ResourceTreeNode[]) {
  const counts: Partial<Record<HealthStatus, number>> = {};
  for (const n of nodes) {
    const h = n.health?.status ?? 'Unknown';
    counts[h] = (counts[h] ?? 0) + 1;
  }
  return counts;
}

function formatResourceBreakdown(
  counts: Partial<Record<HealthStatus, number>>,
): string {
  const order: HealthStatus[] = [
    'Healthy',
    'Progressing',
    'Suspended',
    'Degraded',
    'Unknown',
  ];
  return order
    .filter(s => (counts[s] ?? 0) > 0)
    .map(s => `${counts[s]} ${s}`)
    .join(' \u00b7 ');
}

function getLatestCreatedAt(nodes: ResourceTreeNode[]): string | undefined {
  let latest: string | undefined;
  for (const n of nodes) {
    if (n.createdAt) {
      if (!latest || n.createdAt > latest) {
        latest = n.createdAt;
      }
    }
  }
  return latest;
}

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return 'just now';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

interface ReleaseStatusBarProps {
  releaseData: ReleaseData;
  resourceTreeData: ResourceTreeData;
  releaseBindingData?: Record<string, unknown> | null;
}

export const ReleaseStatusBar: FC<ReleaseStatusBarProps> = ({
  releaseData,
  resourceTreeData,
  releaseBindingData,
}) => {
  const classes = useTreeStyles();

  const { health, resources, lastUpdated } = useMemo(() => {
    const h = getOverallHealth(releaseData, releaseBindingData);
    const nodes = getResourceTreeNodes(resourceTreeData);
    const counts = getResourceCounts(nodes);
    const latestTime = getLatestCreatedAt(nodes);

    return {
      health: h,
      resources: {
        total: nodes.length,
        breakdown: formatResourceBreakdown(counts),
      },
      lastUpdated: latestTime
        ? {
            relative: formatRelativeTime(latestTime),
            absolute: formatTimestamp(latestTime),
          }
        : undefined,
    };
  }, [releaseData, resourceTreeData, releaseBindingData]);

  const badgeStatus = getHealthStatusForTab(health.status) ?? 'default';

  return (
    <div className={classes.statusBar}>
      {/* Health Section */}
      <div className={classes.statusBarSection}>
        <Typography className={classes.statusBarLabel}>Health</Typography>
        <div className={classes.statusBarValue}>
          <StatusBadge status={badgeStatus} label={health.label} />
        </div>
        {health.reason && (
          <Typography className={classes.statusBarDetail}>
            Reason: {health.reason}
          </Typography>
        )}
      </div>

      {/* Resources Section */}
      <div className={classes.statusBarSection}>
        <Typography className={classes.statusBarLabel}>Resources</Typography>
        <div className={classes.statusBarValue}>
          <Typography variant="body2">
            {resources.total} resource{resources.total !== 1 ? 's' : ''}
          </Typography>
        </div>
        {resources.breakdown && (
          <Typography className={classes.statusBarDetail}>
            {resources.breakdown}
          </Typography>
        )}
      </div>

      {/* Last Updated Section */}
      <div className={classes.statusBarSection}>
        <Typography className={classes.statusBarLabel}>Last Updated</Typography>
        <div className={classes.statusBarValue}>
          <Typography variant="body2">
            {lastUpdated?.relative ?? 'N/A'}
          </Typography>
        </div>
        {lastUpdated?.absolute && (
          <Typography className={classes.statusBarDetail}>
            {lastUpdated.absolute}
          </Typography>
        )}
      </div>
    </div>
  );
};
