import { Grid } from '@material-ui/core';
import { EntityLatestJenkinsRunCard } from '@backstage-community/plugin-jenkins';
import { EntityRecentGithubActionsRunsCard } from '@backstage-community/plugin-github-actions';
import { EntityGitlabPipelinesTable } from '@immobiliarelabs/backstage-plugin-gitlab';
import { AnnotationGate } from '@openchoreo/backstage-plugin-react';

/**
 * CI Status Cards for the Component Overview page.
 *
 * Each card is wrapped in an AnnotationGate that only renders the card
 * when the corresponding CI platform annotation is present on the entity.
 *
 * Supported annotations:
 * - jenkins.io/job-full-name: Shows Jenkins build status
 * - github.com/project-slug: Shows GitHub Actions runs
 * - gitlab.com/project-slug or gitlab.com/project-id: Shows GitLab pipelines
 */
export function CIStatusCards() {
  return (
    <>
      {/* Jenkins Card - only shows if annotation is present */}
      <AnnotationGate annotation="jenkins.io/job-full-name">
        <Grid item md={6} xs={12}>
          <EntityLatestJenkinsRunCard branch="main,master" variant="gridItem" />
        </Grid>
      </AnnotationGate>

      {/* GitHub Actions Card - only shows if annotation is present */}
      <AnnotationGate annotation="github.com/project-slug">
        <Grid item md={6} xs={12}>
          <EntityRecentGithubActionsRunsCard limit={4} variant="gridItem" />
        </Grid>
      </AnnotationGate>

      {/* GitLab Pipelines Card - shows if either project-slug or project-id annotation is present */}
      <AnnotationGate
        annotations={['gitlab.com/project-slug', 'gitlab.com/project-id']}
      >
        <Grid item md={6} xs={12}>
          <EntityGitlabPipelinesTable />
        </Grid>
      </AnnotationGate>
    </>
  );
}
