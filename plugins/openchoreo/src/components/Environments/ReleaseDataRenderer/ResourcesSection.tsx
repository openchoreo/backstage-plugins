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
import { ReleaseResource } from './types';
import { StyleClasses } from './styles';
import { getHealthChipClass, formatTimestamp } from './utils';

interface ResourcesSectionProps {
  resources: ReleaseResource[];
  classes: StyleClasses;
}

export const ResourcesSection: FC<ResourcesSectionProps> = ({
  resources,
  classes,
}) => (
  <Box className={classes.section}>
    <Typography className={classes.sectionTitle}>
      Resources ({resources.length})
    </Typography>
    {resources.map((resource, index) => (
      <Box key={resource.id || index} className={classes.resourceCard}>
        <Box className={classes.resourceHeader}>
          <Typography className={classes.resourceKind}>
            {resource.kind}
          </Typography>
          {resource.healthStatus && (
            <Chip
              label={resource.healthStatus}
              size="small"
              className={getHealthChipClass(resource.healthStatus, classes)}
            />
          )}
        </Box>
        <Grid container spacing={1}>
          <Grid item xs={12} sm={6}>
            <Box className={classes.propertyRow}>
              <Typography className={classes.propertyKey}>Name:</Typography>
              <Typography className={classes.propertyValueCode}>
                {resource.name}
              </Typography>
            </Box>
          </Grid>
          {resource.namespace && (
            <Grid item xs={12} sm={6}>
              <Box className={classes.propertyRow}>
                <Typography className={classes.propertyKey}>
                  Namespace:
                </Typography>
                <Typography className={classes.propertyValueCode}>
                  {resource.namespace}
                </Typography>
              </Box>
            </Grid>
          )}
          <Grid item xs={12} sm={6}>
            <Box className={classes.propertyRow}>
              <Typography className={classes.propertyKey}>
                API Version:
              </Typography>
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
        {resource.status && Object.keys(resource.status).length > 0 && (
          <Box style={{ marginTop: '12px' }}>
            <Accordion className={classes.accordion}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="body2" style={{ fontWeight: 500 }}>
                  Resource Status Details
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <pre
                  style={{
                    margin: 0,
                    fontSize: '0.75rem',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {JSON.stringify(resource.status, null, 2)}
                </pre>
              </AccordionDetails>
            </Accordion>
          </Box>
        )}
      </Box>
    ))}
  </Box>
);
