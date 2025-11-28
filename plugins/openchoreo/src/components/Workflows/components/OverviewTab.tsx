import { Typography, Box } from '@material-ui/core';
import { WorkflowDetailsRenderer } from '../WorkflowDetailsRenderer';
import { useWorkflowStyles } from '../styles';
import type { ModelsCompleteComponent } from '@openchoreo/backstage-plugin-common';

interface OverviewTabProps {
  workflow: ModelsCompleteComponent['componentWorkflow'] | null | undefined;
}

export const OverviewTab = ({ workflow }: OverviewTabProps) => {
  const classes = useWorkflowStyles();

  if (!workflow) {
    return (
      <Box className={classes.emptyStateCard}>
        <Typography variant="body1" color="textSecondary">
          No workflow details available for this component.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box className={classes.propertyRow} style={{ marginBottom: '16px' }}>
        <Typography className={classes.propertyKey}>Workflow Name:</Typography>
        <Typography className={classes.propertyValue}>
          {workflow.name}
        </Typography>
      </Box>
      {workflow.systemParameters &&
        Object.keys(workflow.systemParameters).length > 0 && (
          <WorkflowDetailsRenderer data={workflow.systemParameters} />
        )}
      {workflow.parameters && Object.keys(workflow.parameters).length > 0 && (
        <WorkflowDetailsRenderer data={workflow.parameters} />
      )}
    </Box>
  );
};
