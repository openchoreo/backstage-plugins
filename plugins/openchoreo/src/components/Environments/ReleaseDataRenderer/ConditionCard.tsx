import type { FC } from 'react';
import { Typography, Box, Grid } from '@material-ui/core';
import { ReleaseCondition } from './types';
import { ReleaseInfoStyleClasses } from './styles';
import { formatTimestamp } from './utils';

interface ConditionCardProps {
  condition: ReleaseCondition;
  classes: ReleaseInfoStyleClasses;
}

/**
 * Displays a single release condition with its details.
 */
export const ConditionCard: FC<ConditionCardProps> = ({
  condition,
  classes,
}) => (
  <Box className={classes.resourceCard}>
    <Grid container spacing={1}>
      <Grid item xs={12} sm={4}>
        <Box className={classes.propertyRow}>
          <Typography className={classes.propertyKey}>Type:</Typography>
          <Typography className={classes.propertyValue}>
            {condition.type}
          </Typography>
        </Box>
      </Grid>
      <Grid item xs={12} sm={4}>
        <Box className={classes.propertyRow}>
          <Typography className={classes.propertyKey}>Status:</Typography>
          <Typography className={classes.propertyValue}>
            {condition.status}
          </Typography>
        </Box>
      </Grid>
      {condition.lastTransitionTime && (
        <Grid item xs={12} sm={4}>
          <Box className={classes.propertyRow}>
            <Typography className={classes.propertyKey}>
              Last Transition:
            </Typography>
            <Typography className={classes.propertyValue}>
              {formatTimestamp(condition.lastTransitionTime)}
            </Typography>
          </Box>
        </Grid>
      )}
      {condition.reason && (
        <Grid item xs={12}>
          <Box className={classes.propertyRow}>
            <Typography className={classes.propertyKey}>Reason:</Typography>
            <Typography className={classes.propertyValue}>
              {condition.reason}
            </Typography>
          </Box>
        </Grid>
      )}
      {condition.message && (
        <Grid item xs={12}>
          <Box className={classes.propertyRow}>
            <Typography className={classes.propertyKey}>Message:</Typography>
            <Typography className={classes.propertyValue}>
              {condition.message}
            </Typography>
          </Box>
        </Grid>
      )}
    </Grid>
  </Box>
);
