import type { FC } from 'react';
import {
  Typography,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { JsonViewer } from '@openchoreo/backstage-design-system';
import { ResourceGroup } from './useResourceGroups';
import { ReleaseInfoStyleClasses } from './styles';
import { ResourceCard } from './ResourceCard';

interface ResourceGroupTabProps {
  group: ResourceGroup;
  classes: ReleaseInfoStyleClasses;
}

/**
 * Renders a resource group tab with status resources and definitions.
 */
export const ResourceGroupTab: FC<ResourceGroupTabProps> = ({
  group,
  classes,
}) => (
  <Box>
    {/* Status Resources */}
    {group.resources.length > 0 && (
      <Box className={classes.section}>
        <Typography className={classes.sectionTitle}>
          {group.kind} Resources ({group.resources.length})
        </Typography>
        {group.resources.map((resource, index) => (
          <ResourceCard
            key={resource.id || index}
            resource={resource}
            classes={classes}
          />
        ))}
      </Box>
    )}

    {/* Resource Definitions */}
    {group.definitions.length > 0 && (
      <Box className={classes.section}>
        <Typography className={classes.sectionTitle}>
          Resource Definitions ({group.definitions.length})
        </Typography>
        {group.definitions.map((def, index) => (
          <Accordion key={def.id || index} className={classes.accordion}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2" style={{ fontWeight: 500 }}>
                {def.id}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <JsonViewer value={def.object} maxHeight="500px" />
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    )}

    {group.resources.length === 0 && group.definitions.length === 0 && (
      <Typography className={classes.emptyValue}>
        No resources found for this type
      </Typography>
    )}
  </Box>
);
