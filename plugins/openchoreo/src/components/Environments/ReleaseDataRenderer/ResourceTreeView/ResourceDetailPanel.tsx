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
import { useTreeStyles } from './treeStyles';
import type { LayoutNode } from './treeTypes';
import { formatTimestamp, getHealthChipClass } from '../utils';
import { useReleaseInfoStyles } from '../styles';

interface ResourceDetailPanelProps {
  node: LayoutNode | null;
  onClose: () => void;
  entity: Entity;
  environmentName: string;
}

export const ResourceDetailPanel: FC<ResourceDetailPanelProps> = ({
  node,
  onClose,
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
            <IconButton onClick={onClose} size="small">
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
                  node.group
                    ? `${node.group}/${node.version}`
                    : node.version
                }
                size="small"
                variant="outlined"
              />
            )}
          </Box>

          <Divider />

          {/* Content: root summary or tabs */}
          {node.isRoot ? (
            <Box mt={2}>
              <Box className={classes.drawerProperty}>
                <Typography className={classes.drawerPropertyKey}>
                  Kind
                </Typography>
                <Typography className={classes.drawerPropertyValue}>
                  {node.kind}
                </Typography>
              </Box>

              {node.healthStatus && (
                <Box className={classes.drawerProperty}>
                  <Typography className={classes.drawerPropertyKey}>
                    Health
                  </Typography>
                  <Chip
                    label={node.healthStatus}
                    size="small"
                    className={getHealthChipClass(
                      node.healthStatus,
                      releaseClasses,
                    )}
                  />
                </Box>
              )}

              {node.lastObservedTime && (
                <Box className={classes.drawerProperty}>
                  <Typography className={classes.drawerPropertyKey}>
                    Last Observed
                  </Typography>
                  <Typography className={classes.drawerPropertyValue}>
                    {formatTimestamp(node.lastObservedTime)}
                  </Typography>
                </Box>
              )}
            </Box>
          ) : (
            <ResourceDetailTabs node={node} entity={entity} environmentName={environmentName} />
          )}
        </Box>
      )}
    </Drawer>
  );
};
