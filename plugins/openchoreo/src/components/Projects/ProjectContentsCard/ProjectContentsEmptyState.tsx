import { Entity } from '@backstage/catalog-model';
import { Box, Typography } from '@material-ui/core';
import { CreateProjectContentButton } from './CreateProjectContentButton';
import { useProjectContentsCardStyles } from './styles';

/**
 * Onboarding empty state shown when a project has no Components or Resources at
 * all (not when filters simply exclude everything). A concise message and one
 * outlined "Create" action.
 */
export const ProjectContentsEmptyState = ({ entity }: { entity: Entity }) => {
  const classes = useProjectContentsCardStyles();

  return (
    <Box className={classes.emptyState}>
      <Box className={classes.emptyText}>
        <Typography variant="h5" className={classes.emptyTitle}>
          This project is empty
        </Typography>
        <Typography variant="body2" className={classes.emptySubtitle}>
          Components and resources you add will appear here
        </Typography>
      </Box>
      <CreateProjectContentButton entity={entity} />
    </Box>
  );
};
