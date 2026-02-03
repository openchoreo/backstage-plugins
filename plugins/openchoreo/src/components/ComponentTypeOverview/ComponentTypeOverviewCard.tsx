import { useMemo } from 'react';
import { Box, Chip, Typography } from '@material-ui/core';
import CategoryIcon from '@material-ui/icons/Category';
import AccessTimeIcon from '@material-ui/icons/AccessTime';
import { parseEntityRef } from '@backstage/catalog-model';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Link } from '@backstage/core-components';
import { Card } from '@openchoreo/backstage-design-system';
import {
  CHOREO_ANNOTATIONS,
  RELATION_USES_WORKFLOW,
} from '@openchoreo/backstage-plugin-common';
import { useDataplaneOverviewStyles } from '../DataplaneOverview/styles';

export const ComponentTypeOverviewCard = () => {
  const classes = useDataplaneOverviewStyles();
  const { entity } = useEntity();

  const spec = entity.spec as any;
  const annotations = entity.metadata.annotations || {};

  const workloadType = spec?.workloadType || 'Unknown';
  const allowedWorkflows: string[] = spec?.allowedWorkflows || [];
  const createdAt = annotations[CHOREO_ANNOTATIONS.CREATED_AT];

  // Build workflow links from relations
  const workflowLinks = useMemo(() => {
    const relations = entity.relations || [];
    return relations
      .filter(r => r.type === RELATION_USES_WORKFLOW)
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
        <Typography variant="h5">Component Type Details</Typography>
      </Box>

      <Box className={classes.statusGrid}>
        <Box className={classes.statusItem}>
          <CategoryIcon className={classes.statusIcon} />
          <Box>
            <Typography className={classes.statusLabel}>
              Workload Type
            </Typography>
            <Chip label={workloadType} size="small" />
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

      {allowedWorkflows.length > 0 && (
        <Box mt={2}>
          <Typography className={classes.statusLabel} gutterBottom>
            Allowed Workflows ({allowedWorkflows.length})
          </Typography>
          <Box display="flex" flexWrap="wrap" gridGap={8}>
            {allowedWorkflows.map(wfName => {
              const wfLink = workflowLinks.find(wl => wl.name === wfName);
              return wfLink ? (
                <Chip
                  key={wfName}
                  label={<Link to={wfLink.link}>{wfName}</Link>}
                  size="small"
                  variant="outlined"
                />
              ) : (
                <Chip
                  key={wfName}
                  label={wfName}
                  size="small"
                  variant="outlined"
                />
              );
            })}
          </Box>
        </Box>
      )}
    </Card>
  );
};
