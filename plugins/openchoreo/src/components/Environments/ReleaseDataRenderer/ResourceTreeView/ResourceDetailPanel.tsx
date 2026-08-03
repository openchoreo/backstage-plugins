import type { FC } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Divider,
  Chip,
} from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import { ResourceKindIcon } from './ResourceKindIcon';
import { ResourceDetailTabs } from './ResourceDetailTabs';
import { ReleaseDetailTabs } from './ReleaseDetailTabs';
import { ReleaseBindingDetailTabs } from './ReleaseBindingDetailTabs';
import { useTreeStyles } from './treeStyles';
import type { ExecContext, LayoutNode } from './treeTypes';
import { getHealthChipClass } from '../utils';
import { useReleaseInfoStyles } from '../styles';

interface ResourceDetailPanelProps {
  node: LayoutNode | null;
  onClose: () => void;
  releaseBindingData: Record<string, unknown> | null;
  namespaceName: string;
  releaseBindingName: string;
  /** Component/environment context for opening an exec terminal. */
  execContext?: ExecContext;
  /**
   * Whether the rendered tree contains a Pod node. When false, the Terminal
   * falls back to the ReleaseBinding (root) drawer.
   */
  hasPodNode?: boolean;
}

export const ResourceDetailPanel: FC<ResourceDetailPanelProps> = ({
  node,
  onClose,
  releaseBindingData,
  namespaceName,
  releaseBindingName,
  execContext,
  hasPodNode,
}) => {
  const classes = useTreeStyles();
  const releaseClasses = useReleaseInfoStyles();

  return (
    <Drawer anchor="right" open={node !== null} onClose={onClose}>
      {node && (
        <Box className={classes.drawer}>
          {/* Header */}
          <Box className={classes.drawerHeader}>
            <Box className={classes.drawerHeaderLeft}>
              <ResourceKindIcon kind={node.kind} />
              <Typography variant="h6" className={classes.drawerTitle}>
                {node.name}
              </Typography>
            </Box>
            <IconButton onClick={onClose} size="small" aria-label="Close">
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Metadata row */}
          <Box className={classes.drawerMetadataRow}>
            {node.namespace && (
              <Chip label={node.namespace} size="small" variant="outlined" />
            )}
            {node.healthStatus && (
              <Chip
                label={node.healthStatus}
                size="small"
                className={getHealthChipClass(
                  node.healthStatus,
                  releaseClasses,
                )}
              />
            )}
            {(node.group || node.version) && (
              <Chip
                label={
                  node.group && node.version
                    ? `${node.group}/${node.version}`
                    : node.group || node.version
                }
                size="small"
                variant="outlined"
              />
            )}
          </Box>

          <Divider />

          {/* Content: root summary/definition tabs, release summary, or resource tabs */}
          {node.isRoot && (
            <ReleaseBindingDetailTabs
              releaseBindingData={releaseBindingData}
              // Fallback Terminal lives on the ReleaseBinding drawer only when
              // no Pod node is rendered in the tree (pod managed elsewhere).
              execContext={execContext && !hasPodNode ? execContext : undefined}
            />
          )}
          {!node.isRoot && node.kind === 'RenderedRelease' && (
            <ReleaseDetailTabs node={node} />
          )}
          {!node.isRoot && node.kind !== 'RenderedRelease' && (
            <ResourceDetailTabs
              node={node}
              namespaceName={namespaceName}
              releaseBindingName={releaseBindingName}
              execContext={execContext}
            />
          )}
        </Box>
      )}
    </Drawer>
  );
};
