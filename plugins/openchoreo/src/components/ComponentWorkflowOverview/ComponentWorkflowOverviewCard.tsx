import { useMemo } from 'react';
import { Box, Chip, Typography } from '@material-ui/core';
import SettingsApplicationsIcon from '@material-ui/icons/SettingsApplications';
import AccessTimeIcon from '@material-ui/icons/AccessTime';
import { parseEntityRef } from '@backstage/catalog-model';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Link } from '@backstage/core-components';
import { Card } from '@openchoreo/backstage-design-system';
import {
  CHOREO_ANNOTATIONS,
  RELATION_WORKFLOW_USED_BY,
} from '@openchoreo/backstage-plugin-common';
import { useDataplaneOverviewStyles } from '../DataplaneOverview/styles';

export const ComponentWorkflowOverviewCard = () => {
  const classes = useDataplaneOverviewStyles();
  const { entity } = useEntity();

  const annotations = entity.metadata.annotations || {};
  const createdAt = annotations[CHOREO_ANNOTATIONS.CREATED_AT];
  const description = entity.metadata.description;

  // Find which ComponentTypes use this workflow via inverse relation
  const usedByLinks = useMemo(() => {
    const relations = entity.relations || [];
    return relations
      .filter(r => r.type === RELATION_WORKFLOW_USED_BY)
      .map(r => {
        try {
          const ref = parseEntityRef(r.targetRef);
          return {
            name: ref.name,
            link: `/catalog/${ref.namespace}/${ref.kind.toLowerCase()}/${
              ref.name
            }`,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean) as { name: string; link: string }[];
  }, [entity.relations]);

  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <Card padding={24} className={classes.card}>
      <Box className={classes.cardHeader}>
        <Typography variant="h5">Component Workflow Details</Typography>
      </Box>

      <Box className={classes.statusGrid}>
        <Box className={classes.statusItem}>
          <SettingsApplicationsIcon className={classes.statusIcon} />
          <Box>
            <Typography className={classes.statusLabel}>Type</Typography>
            <Typography className={classes.statusValue}>
              Build Workflow
            </Typography>
          </Box>
        </Box>

        {createdAt && (
          <Box className={classes.statusItem}>
            <AccessTimeIcon className={classes.statusIcon} />
            <Box>
              <Typography className={classes.statusLabel}>Created</Typography>
              <Typography className={classes.statusValue}>
                {formatDate(createdAt)}
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      {description && (
        <Box mt={2}>
          <Typography className={classes.statusLabel} gutterBottom>
            Description
          </Typography>
          <Typography variant="body2">{description}</Typography>
        </Box>
      )}

      {usedByLinks.length > 0 && (
        <Box mt={2}>
          <Typography className={classes.statusLabel} gutterBottom>
            Used by Component Types ({usedByLinks.length})
          </Typography>
          <Box display="flex" flexWrap="wrap" gridGap={8}>
            {usedByLinks.map(ct => (
              <Chip
                key={ct.name}
                label={<Link to={ct.link}>{ct.name}</Link>}
                size="small"
                variant="outlined"
              />
            ))}
          </Box>
        </Box>
      )}
    </Card>
  );
};
