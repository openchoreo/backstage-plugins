import { EmptyState } from '@backstage/core-components';
import {
  ForbiddenState,
  type ProjectEnvironmentsStatus,
} from '@openchoreo/backstage-plugin-react';

export interface EnvironmentsStatusNoticeProps {
  /** The environments-resolution status from `useProjectEnvironments`. */
  status: ProjectEnvironmentsStatus;
  /**
   * What the page shows (e.g. `logs`, `metrics`), used to make the empty-state
   * title specific: "No environments available to view {feature}". Falls back
   * to a generic title when omitted.
   */
  feature?: string;
}

/**
 * Renders a cause-specific notice when a project's environments can't be
 * shown, so observability pages explain *what happened* instead of a generic
 * "no environments found". Uses the standard Backstage `EmptyState` to match
 * the Deploy tab. Returns `null` for the `ok` status.
 */
export const EnvironmentsStatusNotice = ({
  status,
  feature,
}: EnvironmentsStatusNoticeProps) => {
  if (status === 'ok') {
    return null;
  }

  if (status === 'forbidden') {
    return (
      <ForbiddenState
        message="You do not have permission to view this project's deployment pipeline."
        variant="compact"
      />
    );
  }

  if (status === 'empty-pipeline') {
    return (
      <EmptyState
        missing="content"
        title={
          feature
            ? `No environments available to view ${feature}`
            : 'No environments available'
        }
        description="This project's deployment pipeline has no environments configured. Review the deployment pipeline or contact your administrator."
      />
    );
  }

  // status === 'unavailable'
  return (
    <EmptyState
      missing="data"
      title="Failed to load environments"
      description="Couldn't load this project's deployment pipeline. Review the deployment pipeline or contact your administrator."
    />
  );
};
