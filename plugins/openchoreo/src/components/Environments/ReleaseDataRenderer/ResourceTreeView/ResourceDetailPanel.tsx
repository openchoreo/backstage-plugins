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
import { Entity } from '@backstage/catalog-model';
import { ResourceKindIcon } from './ResourceKindIcon';
import { ResourceDetailTabs } from './ResourceDetailTabs';
import { ReleaseBindingDetailTabs } from './ReleaseBindingDetailTabs';
import { useTreeStyles } from './treeStyles';
import type { LayoutNode } from './treeTypes';
import { getHealthChipClass } from '../utils';
import { useReleaseInfoStyles } from '../styles';
import type { ReleaseData } from '../types';

interface ResourceDetailPanelProps {
  node: LayoutNode | null;
  onClose: () => void;
  releaseData: ReleaseData;
  releaseBindingData: Record<string, unknown> | null;
  entity: Entity;
  environmentName: string;
}

export const ResourceDetailPanel: FC<ResourceDetailPanelProps> = ({
  node,
  onClose,
  releaseData,
  releaseBindingData,
  entity,
  environmentName,
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

          {/* Content: root summary/definition tabs or resource tabs */}
          {node.isRoot ? (
            <ReleaseBindingDetailTabs
              releaseData={releaseData}
              releaseBindingData={releaseBindingData}
            />
          ) : (
            <ResourceDetailTabs
              node={node}
              entity={entity}
              environmentName={environmentName}
            />
          )}
        </Box>
      )}
    </Drawer>
  );
};
