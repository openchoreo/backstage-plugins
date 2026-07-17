import { EmptyState } from '@backstage/core-components';

export interface NoEnvironmentsEmptyStateProps {
  /**
   * What the page shows (e.g. `logs`, `metrics`), used to make the title
   * specific: "No environments available to view {feature}".
   */
  feature: string;
}

/**
 * Empty state shown when a project's deployment pipeline has no environments
 * configured, so observability pages explain what happened instead of
 * rendering empty filters. Uses the standard Backstage `EmptyState` to match
 * the Deploy tab.
 */
export const NoEnvironmentsEmptyState = ({
  feature,
}: NoEnvironmentsEmptyStateProps) => (
  <EmptyState
    missing="content"
    title={`No environments available to view ${feature}`}
    description="This project's deployment pipeline has no environments configured. Review the deployment pipeline or contact your administrator."
  />
);
