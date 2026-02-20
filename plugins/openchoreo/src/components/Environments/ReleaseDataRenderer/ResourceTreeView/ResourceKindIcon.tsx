import type { FC } from 'react';
import clsx from 'clsx';
import { useTreeStyles } from './treeStyles';

/** Abbreviated labels for common Kubernetes resource kinds */
const KIND_LABELS: Record<string, string> = {
  Deployment: 'deploy',
  CronJob: 'cronjob',
  Job: 'job',
  Service: 'svc',
  HTTPRoute: 'httproute',
  Ingress: 'ingress',
  ConfigMap: 'cm',
  Secret: 'secret',
  StatefulSet: 'sts',
  DaemonSet: 'ds',
  ReplicaSet: 'rs',
  Pod: 'pod',
  ServiceAccount: 'sa',
  PersistentVolumeClaim: 'pvc',
  HorizontalPodAutoscaler: 'hpa',
  ReleaseBinding: 'release',
};

interface ResourceKindIconProps {
  kind: string;
  isRoot?: boolean;
}

export const ResourceKindIcon: FC<ResourceKindIconProps> = ({
  kind,
  isRoot,
}) => {
  const classes = useTreeStyles();

  // Extract uppercase initials (e.g., "Deployment" -> "D", "CronJob" -> "CJ")
  const initials = kind.replace(/[a-z]/g, '');
  const displayInitials = initials.length > 3 ? initials.slice(0, 2) : initials;
  const label = KIND_LABELS[kind] ?? kind.toLowerCase();

  return (
    <div className={classes.kindIconContainer}>
      <div
        className={clsx(
          classes.kindIcon,
          isRoot && classes.kindIconRoot,
          displayInitials.length > 2 && classes.kindIconSmallText,
        )}
      >
        {displayInitials}
      </div>
      <span className={classes.kindLabel}>{label}</span>
    </div>
  );
};
