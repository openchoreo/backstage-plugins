import type { FC } from 'react';
import { Typography, Box, Grid } from '@material-ui/core';
import { ReleaseData } from './types';
import { ReleaseInfoStyleClasses } from './styles';
import { ConditionCard } from './ConditionCard';

interface OverviewTabProps {
  data: ReleaseData['data'];
  classes: ReleaseInfoStyleClasses;
}

/**
 * Renders the Overview tab content with release info and conditions.
 */
export const OverviewTab: FC<OverviewTabProps> = ({ data, classes }) => {
  const spec = data?.spec;
  if (!spec) return null;

  return (
    <Box>
      <Typography className={classes.sectionTitle}>Release Overview</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <Box className={classes.propertyRow}>
            <Typography className={classes.propertyKey}>
              Environment:
            </Typography>
            <Typography className={classes.propertyValue}>
              {spec.environmentName || 'N/A'}
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Box className={classes.propertyRow}>
            <Typography className={classes.propertyKey}>Project:</Typography>
            <Typography className={classes.propertyValue}>
              {spec.owner?.projectName || 'N/A'}
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Box className={classes.propertyRow}>
            <Typography className={classes.propertyKey}>Component:</Typography>
            <Typography className={classes.propertyValue}>
              {spec.owner?.componentName || 'N/A'}
            </Typography>
          </Box>
        </Grid>
        {spec.interval && (
          <Grid item xs={12} sm={6}>
            <Box className={classes.propertyRow}>
              <Typography className={classes.propertyKey}>
                Watch Interval:
              </Typography>
              <Typography className={classes.propertyValueCode}>
                {spec.interval}
              </Typography>
            </Box>
          </Grid>
        )}
      </Grid>

      {/* Conditions section */}
      {data?.status?.conditions && data.status.conditions.length > 0 && (
        <Box mt={3}>
          <Typography className={classes.sectionTitle}>Conditions</Typography>
          {data.status.conditions.map((condition, index) => (
            <ConditionCard
              key={index}
              condition={condition}
              classes={classes}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};
