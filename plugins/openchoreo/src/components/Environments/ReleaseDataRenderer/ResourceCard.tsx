import type { FC } from 'react';
import {
  Typography,
  Box,
  Grid,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { JsonViewer } from '@openchoreo/backstage-design-system';
import { ReleaseResource } from './types';
import { ReleaseInfoStyleClasses } from './styles';
import { formatTimestamp, getHealthChipClass } from './utils';

interface ResourceCardProps {
  resource: ReleaseResource;
  classes: ReleaseInfoStyleClasses;
}

/**
 * Displays a single resource with its status and details.
 */
export const ResourceCard: FC<ResourceCardProps> = ({ resource, classes }) => (
  <Box className={classes.resourceCard}>
    <Box className={classes.resourceHeader}>
      <Typography className={classes.resourceName}>{resource.name}</Typography>
      {resource.healthStatus && (
        <Chip
          label={resource.healthStatus}
          size="small"
          className={getHealthChipClass(resource.healthStatus, classes)}
        />
      )}
    </Box>
    <Grid container spacing={1}>
      {resource.namespace && (
        <Grid item xs={12} sm={6}>
          <Box className={classes.propertyRow}>
            <Typography className={classes.propertyKey}>Namespace:</Typography>
            <Typography className={classes.propertyValueCode}>
              {resource.namespace}
            </Typography>
          </Box>
        </Grid>
      )}
      <Grid item xs={12} sm={6}>
        <Box className={classes.propertyRow}>
          <Typography className={classes.propertyKey}>API Version:</Typography>
          <Typography className={classes.propertyValueCode}>
            {resource.group
              ? `${resource.group}/${resource.version}`
              : resource.version}
          </Typography>
        </Box>
      </Grid>
      {resource.lastObservedTime && (
        <Grid item xs={12} sm={6}>
          <Box className={classes.propertyRow}>
            <Typography className={classes.propertyKey}>
              Last Observed:
            </Typography>
            <Typography className={classes.propertyValue}>
              {formatTimestamp(resource.lastObservedTime)}
            </Typography>
          </Box>
        </Grid>
      )}
    </Grid>

    {/* Status Details Accordion */}
    {resource.status && Object.keys(resource.status).length > 0 && (
      <Box mt={2}>
        <Accordion className={classes.accordion}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="body2" style={{ fontWeight: 500 }}>
              Status Details
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <JsonViewer value={resource.status} maxHeight="400px" />
          </AccordionDetails>
        </Accordion>
      </Box>
    )}
  </Box>
);
