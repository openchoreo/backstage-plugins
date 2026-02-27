import type { FC } from 'react';
import clsx from 'clsx';
import { ResourceKindIcon } from './ResourceKindIcon';
import { useTreeStyles } from './treeStyles';
import type { LayoutNode } from './treeTypes';
import type { HealthStatus } from '../types';

/** Get the CSS class for a health status dot */
function getHealthDotClass(
  healthStatus: HealthStatus | undefined,
  classes: ReturnType<typeof useTreeStyles>,
): string {
  switch (healthStatus) {
    case 'Healthy':
      return classes.healthHealthy;
    case 'Degraded':
      return classes.healthDegraded;
    case 'Progressing':
      return classes.healthProgressing;
    case 'Suspended':
      return classes.healthSuspended;
    default:
      return classes.healthUnknown;
  }
}

interface ResourceTreeNodeProps {
  node: LayoutNode;
  isSelected: boolean;
  onClick: () => void;
}

export const ResourceTreeNode: FC<ResourceTreeNodeProps> = ({
  node,
  isSelected,
  onClick,
}) => {
  const classes = useTreeStyles();

  return (
    <div
      className={clsx(
        classes.node,
        isSelected && classes.nodeSelected,
        node.isRoot && classes.nodeRoot,
      )}
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
      }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      title={node.name}
    >
      <ResourceKindIcon kind={node.kind} isRoot={node.isRoot} />
      <div className={classes.nodeContent}>
        <span className={classes.nodeKind}>{node.kind}</span>
        <span className={classes.nodeName}>{node.name}</span>
        {node.kind === 'Release' && node.version && (
          <span className={classes.nodeSubtitle}>
            Target plane: {node.version}
          </span>
        )}
      </div>
      {node.healthStatus && (
        <div className={classes.healthDotContainer}>
          <span
            className={clsx(
              classes.healthDot,
              getHealthDotClass(node.healthStatus, classes),
            )}
            title={node.healthStatus}
          />
        </div>
      )}
    </div>
  );
};
