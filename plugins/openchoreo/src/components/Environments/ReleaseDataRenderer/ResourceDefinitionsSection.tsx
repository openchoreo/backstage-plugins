import type { FC } from 'react';
import {
  Typography,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { SpecResource } from './types';
import { StyleClasses } from './styles';

interface ResourceDefinitionsSectionProps {
  resources: SpecResource[];
  classes: StyleClasses;
}

export const ResourceDefinitionsSection: FC<
  ResourceDefinitionsSectionProps
> = ({ resources, classes }) => (
  <Box className={classes.section}>
    <Typography className={classes.sectionTitle}>
      Resource Definitions ({resources.length})
    </Typography>
    {resources.map((resource, index) => (
      <Accordion key={resource.id || index} className={classes.accordion}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="body2" style={{ fontWeight: 500 }}>
            {resource.id}
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
            {JSON.stringify(resource.object, null, 2)}
          </pre>
        </AccordionDetails>
      </Accordion>
    ))}
  </Box>
);
