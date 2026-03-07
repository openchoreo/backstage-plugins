import { useState, useMemo, useEffect, type FC } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@material-ui/core';
import RefreshIcon from '@material-ui/icons/Refresh';
import { ResourceTreeEdge } from './ResourceTreeEdge';
import { ResourceTreeNode } from './ResourceTreeNode';
import { ResourceDetailPanel } from './ResourceDetailPanel';
import { ReleaseStatusBar } from './ReleaseStatusBar';
import { useTreeStyles } from './treeStyles';
import { buildTreeNodes, computeTreeLayout } from './treeLayoutUtils';
import type { LayoutNode } from './treeTypes';
import type { ResourceTreeData } from '../types';

interface ResourceTreeViewProps {
  resourceTreeData: ResourceTreeData;
  releaseBindingData: Record<string, unknown> | null;
  namespaceName: string;
  releaseBindingName: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const ResourceTreeView: FC<ResourceTreeViewProps> = ({
  resourceTreeData,
  releaseBindingData,
  namespaceName,
  releaseBindingName,
  onRefresh,
  isRefreshing = false,
}) => {
  const classes = useTreeStyles();
  const [selectedNode, setSelectedNode] = useState<LayoutNode | null>(null);

  const layout = useMemo(() => {
    const nodes = buildTreeNodes(resourceTreeData, releaseBindingData);
    return computeTreeLayout(nodes);
  }, [resourceTreeData, releaseBindingData]);

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
      <Box className={classes.statusBarWrapper}>
        <div className={classes.statusBarContent}>
          <ReleaseStatusBar
            resourceTreeData={resourceTreeData}
            releaseBindingData={releaseBindingData}
          />
        </div>
        <div className={classes.statusBarAction}>
          <Tooltip title="Refresh artifacts">
            <span>
              <IconButton
                size="small"
                onClick={onRefresh}
                disabled={!onRefresh || isRefreshing}
                aria-label="refresh artifacts"
              >
                {isRefreshing ? (
                  <CircularProgress size={18} />
                ) : (
                  <RefreshIcon fontSize="small" />
                )}
              </IconButton>
            </span>
          </Tooltip>
        </div>
      </Box>
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
        releaseBindingData={releaseBindingData}
        namespaceName={namespaceName}
        releaseBindingName={releaseBindingName}
      />
    </Box>
  );
};
