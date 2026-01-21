import { Box, Typography } from '@material-ui/core';
import ArrowForwardIcon from '@material-ui/icons/ArrowForward';
import LockIcon from '@material-ui/icons/Lock';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import TimelineIcon from '@material-ui/icons/Timeline';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Card } from '@openchoreo/backstage-design-system';
import { useDeploymentPipelineOverviewStyles } from './styles';

export const PromotionPathsCard = () => {
  const classes = useDeploymentPipelineOverviewStyles();
  const { entity } = useEntity();

  const spec = entity.spec as any;
  const promotionPaths = spec?.promotionPaths || [];

  const capitalizeFirst = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  if (!promotionPaths || promotionPaths.length === 0) {
    return (
      <Card padding={24} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Typography className={classes.cardTitle}>Promotion Paths</Typography>
        </Box>
        <Box className={classes.emptyState}>
          <TimelineIcon className={classes.emptyIcon} />
          <Typography variant="body2">No promotion paths configured</Typography>
        </Box>
      </Card>
    );
  }

  // Flatten promotion paths for display
  const flattenedPaths: {
    source: string;
    target: string;
    requiresApproval: boolean;
  }[] = [];

  for (const path of promotionPaths) {
    for (const target of path.targetEnvironments || []) {
      flattenedPaths.push({
        source: path.sourceEnvironment,
        target: target.name,
        requiresApproval:
          target.requiresApproval || target.isManualApprovalRequired || false,
      });
    }
  }

  return (
    <Card padding={24} className={classes.card}>
      <Box className={classes.cardHeader}>
        <Typography variant="h5">Promotion Paths</Typography>
      </Box>

      <ul className={classes.promotionPathList}>
        {flattenedPaths.map((path, index) => (
          <li key={index} className={classes.promotionPathItem}>
            <Typography className={classes.pathSource}>
              {capitalizeFirst(path.source)}
            </Typography>

            <ArrowForwardIcon className={classes.pathArrow} />

            <Box className={classes.pathTarget}>
              <Typography className={classes.pathTargetName}>
                {capitalizeFirst(path.target)}
              </Typography>

              {path.requiresApproval ? (
                <Typography className={classes.approvalBadge}>
                  <LockIcon style={{ fontSize: '0.75rem' }} />
                  Requires Approval
                </Typography>
              ) : (
                <Typography className={classes.autoBadge}>
                  <AutorenewIcon
                    style={{
                      fontSize: '0.75rem',
                      verticalAlign: 'middle',
                      marginRight: 2,
                    }}
                  />
                  Auto-promote
                </Typography>
              )}
            </Box>
          </li>
        ))}
      </ul>
    </Card>
  );
};
