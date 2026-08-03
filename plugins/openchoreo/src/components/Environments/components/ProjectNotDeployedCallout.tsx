import { Box, Button, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { Alert, AlertTitle } from '@material-ui/lab';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import { useEntity } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

const useStyles = makeStyles(theme => ({
  root: {
    // Let the callout's own copy carry the message; keep the Alert compact.
    '& .MuiAlert-message': { width: '100%' },
  },
  body: { marginBottom: theme.spacing(1) },
  action: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(0.5),
  },
}));

/**
 * Where the callout is shown — drives only the body copy. The remediation
 * action (open the project's Deploy tab in a new tab) is identical in all
 * three, so this is the single place to swap the trigger if we later move to
 * an in-place flow.
 */
export type ProjectNotDeployedVariant = 'setup' | 'promote' | 'error-dialog';

export interface ProjectNotDeployedCalloutProps {
  /** Environment display name shown in the copy (e.g. "Development"). */
  envName: string;
  /** Environment K8s resource name used in the deep link (e.g. "development"). */
  envResourceName?: string;
  variant: ProjectNotDeployedVariant;
}

/**
 * Warning callout shown when a component targets an environment where its
 * project is not deployed. The component's ReleaseBinding applies into the
 * project's cell namespace, which only exists once the project is deployed
 * there — so deploy/promote is blocked (or has failed) until then.
 *
 * The action deep-links to the project's own Deploy tab in a new browser tab,
 * pre-selected at the blocking environment (`?env=&intent=deploy`), which is
 * the canonical place to deploy a project.
 */
export const ProjectNotDeployedCallout = ({
  envName,
  envResourceName,
  variant,
}: ProjectNotDeployedCalloutProps) => {
  const classes = useStyles();
  const { entity } = useEntity();

  const namespace = entity.metadata.namespace || 'default';
  const projectName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT] ?? '';
  const projectLabel = projectName || 'The project';

  const params = new URLSearchParams({
    env: (envResourceName ?? envName).toLowerCase(),
    intent: 'deploy',
  });
  const deployUrl = `/catalog/${namespace}/system/${projectName}/deploy?${params.toString()}`;

  const body = (() => {
    switch (variant) {
      case 'promote':
        return `${projectLabel} isn't deployed to ${envName}. Deploy the project there before promoting this component.`;
      case 'error-dialog':
        return `${projectLabel} has no deployment in ${envName}, so its namespace doesn't exist on the data plane. Deploy the project to ${envName}, then this component will recover automatically on the next reconcile.`;
      case 'setup':
      default:
        return `${projectLabel} hasn't been deployed to ${envName}. Components can only run in environments where the project is deployed.`;
    }
  })();

  return (
    <Alert severity="warning" className={classes.root} icon={false}>
      <AlertTitle>Project not deployed</AlertTitle>
      <Typography variant="body2" className={classes.body}>
        {body}
      </Typography>
      <Box className={classes.action}>
        <Button
          variant="outlined"
          size="small"
          color="primary"
          endIcon={<OpenInNewIcon fontSize="small" />}
          href={deployUrl}
          target="_blank"
          rel="noopener"
          disabled={!projectName}
          style={{ textTransform: 'none' }}
        >
          Deploy project
        </Button>
      </Box>
    </Alert>
  );
};
