import { Grid } from '@material-ui/core';
import {
  FeatureGate,
  AnnotationGate,
  useHasAnyAnnotation,
} from '@openchoreo/backstage-plugin-react';
import { WorkflowsOverviewCard } from '@openchoreo/backstage-plugin';
import { EntityLatestJenkinsRunCard } from '@backstage-community/plugin-jenkins';
import { EntityRecentGithubActionsRunsCard } from '@backstage-community/plugin-github-actions';
import { EntityGitlabPipelinesTable } from '@immobiliarelabs/backstage-plugin-gitlab';

// Note: External CI integrations (Jenkins, GitHub Actions, GitLab) are controlled by:
// 1. Backend config presence (env vars like JENKINS_BASE_URL, GITHUB_TOKEN, GITLAB_TOKEN)
// 2. Entity annotations (jenkins.io/job-full-name, github.com/project-slug, gitlab.com/project-slug)
// Feature flags are NOT used for CI plugins as backend plugins require config at startup.

const EXTERNAL_CI_ANNOTATIONS = [
  'jenkins.io/job-full-name',
  'github.com/project-slug',
  'gitlab.com/project-slug',
  'gitlab.com/project-id',
];

/**
 * Shows the appropriate CI status card based on entity annotations.
 *
 * If an external CI annotation is present, shows the corresponding external CI card(s).
 * Otherwise, falls back to showing the OpenChoreo WorkflowsOverviewCard.
 *
 * This replaces (rather than supplements) the WorkflowsOverviewCard when an
 * external CI platform is configured for the entity.
 */
export function WorkflowsOrExternalCICard() {
  const hasExternalCI = useHasAnyAnnotation(EXTERNAL_CI_ANNOTATIONS);

  // If external CI annotation present, show the relevant external CI card(s)
  // Cards are gated by annotation presence only - backend config controls API availability
  if (hasExternalCI) {
    return (
      <>
        <AnnotationGate annotation="jenkins.io/job-full-name">
          <Grid item md={4} xs={12}>
            <EntityLatestJenkinsRunCard
              branch="main,master"
              variant="gridItem"
            />
          </Grid>
        </AnnotationGate>

        <AnnotationGate annotation="github.com/project-slug">
          <Grid item md={4} xs={12}>
            <EntityRecentGithubActionsRunsCard limit={4} variant="gridItem" />
          </Grid>
        </AnnotationGate>

        <AnnotationGate
          annotations={['gitlab.com/project-slug', 'gitlab.com/project-id']}
        >
          <Grid item md={4} xs={12}>
            <EntityGitlabPipelinesTable />
          </Grid>
        </AnnotationGate>
      </>
    );
  }

  // No external CI annotation - show OpenChoreo WorkflowsOverviewCard
  return (
    <FeatureGate feature="workflows">
      <Grid item md={4} xs={12}>
        <WorkflowsOverviewCard />
      </Grid>
    </FeatureGate>
  );
}
