import { useState, useMemo, useEffect, type FC } from 'react';
import { Box, Typography } from '@material-ui/core';
import { ResourceTreeEdge } from './ResourceTreeEdge';
import { ResourceTreeNode } from './ResourceTreeNode';
import { ResourceDetailPanel } from './ResourceDetailPanel';
import { ReleaseStatusBar } from './ReleaseStatusBar';
import { useTreeStyles } from './treeStyles';
import { buildTreeNodes, computeTreeLayout } from './treeLayoutUtils';
import type { LayoutNode } from './treeTypes';
import type { ReleaseData, ResourceTreeData } from '../types';

interface ResourceTreeViewProps {
  releaseData: ReleaseData;
  resourceTreeData: ResourceTreeData;
  releaseBindingData: Record<string, unknown> | null;
  namespaceName: string;
  releaseBindingName: string;
}

export const ResourceTreeView: FC<ResourceTreeViewProps> = ({
  releaseData,
  resourceTreeData,
  releaseBindingData,
  namespaceName,
  releaseBindingName,
}) => {
  const classes = useTreeStyles();
  const [selectedNode, setSelectedNode] = useState<LayoutNode | null>(null);

  const layout = useMemo(() => {
    const nodes = buildTreeNodes(
      releaseData,
      resourceTreeData,
      releaseBindingData,
    );
    return computeTreeLayout(nodes);
  }, [releaseData, resourceTreeData, releaseBindingData]);

  useEffect(() => {
    if (selectedNode && !layout.nodes.some(n => n.id === selectedNode.id)) {
      setSelectedNode(null);
    }
  }, [layout, selectedNode]);

  if (layout.nodes.length === 0) {
    return (
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        minHeight={300}
      >
        <Typography variant="body2" color="textSecondary">
          No resources to display in tree view
        </Typography>
      </Box>
    );
  }

  return (
    <Box className={classes.treeContainer}>
      <ReleaseStatusBar
        releaseData={releaseData}
        resourceTreeData={resourceTreeData}
        releaseBindingData={releaseBindingData}
      />
      <div className={classes.treeScrollArea}>
        <div
          className={classes.treeCanvas}
          style={{
            width: layout.width + 150,
            height: layout.height + 100,
          }}
        >
          {/* Edges (rendered first, behind nodes via zIndex) */}
          {layout.edges.map(edge => (
            <ResourceTreeEdge key={`${edge.from}-${edge.to}`} edge={edge} />
          ))}

          {/* Nodes */}
          {layout.nodes.map(node => (
            <ResourceTreeNode
              key={node.id}
              node={node}
              isSelected={selectedNode?.id === node.id}
              onClick={() => setSelectedNode(node)}
            />
          ))}
        </div>
      </div>

      <ResourceDetailPanel
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
        releaseData={releaseData}
        releaseBindingData={releaseBindingData}
        namespaceName={namespaceName}
        releaseBindingName={releaseBindingName}
      />
    </Box>
  );
};
