import type { FC } from 'react';
import { Typography, Box, Grid } from '@material-ui/core';
import { ReleaseSpec } from './types';
import { StyleClasses } from './styles';

interface OverviewSectionProps {
  spec: ReleaseSpec;
  classes: StyleClasses;
}

export const OverviewSection: FC<OverviewSectionProps> = ({
  spec,
  classes,
}) => (
  <Box className={classes.section}>
    <Typography className={classes.sectionTitle}>Overview</Typography>
    <Grid container spacing={2}>
      <Grid item xs={12} sm={6}>
        <Box className={classes.propertyRow}>
          <Typography className={classes.propertyKey}>Environment:</Typography>
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
  </Box>
);
