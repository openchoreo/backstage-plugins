import {
  useResourceReleaseBindingDeleteRevisionPermission,
  useResourceReleaseBindingRollbackPermission,
  useResourceReleaseBindingUpdatePermission,
} from '@openchoreo/backstage-plugin-react';
import type { ResourceEnvironment } from '../../api/OpenChoreoClientApi';
import { BindingRevisionHistory } from '../Environments/components/BindingRevisionHistory';
import { useResourceEnvironmentDetailPanelStyles } from './styles';
import { useResourceEnvironmentsContext } from './ResourceEnvironmentsContext';

export interface ResourceRevisionHistorySectionProps {
  env: ResourceEnvironment;
}

/**
 * The revision history of the environment's ResourceReleaseBinding in the
 * Resource deploy view, sharing the Component view's picker, Revision
 * Browser and rollback confirmation.
 *
 * The resource's releases are not listed here, so a revision whose
 * ResourceRelease was deleted is not marked up front; the rollback preview
 * reports it (RELEASE_DELETED) instead.
 */
export const ResourceRevisionHistorySection = ({
  env,
}: ResourceRevisionHistorySectionProps) => {
  const classes = useResourceEnvironmentDetailPanelStyles();
  const { refetch } = useResourceEnvironmentsContext();
  // ABAC env-aware perms key on the K8s resource name, as elsewhere here.
  const envResourceName = env.resourceName ?? env.name;
  const { canRollback, deniedTooltip } =
    useResourceReleaseBindingRollbackPermission(envResourceName);
  const { canDeleteRevision, deniedTooltip: deleteDeniedTooltip } =
    useResourceReleaseBindingDeleteRevisionPermission(envResourceName);
  const { canUpdate, deniedTooltip: updateDeniedTooltip } =
    useResourceReleaseBindingUpdatePermission(envResourceName);

  return (
    <BindingRevisionHistory
      kind="resource"
      environmentName={env.name}
      envResourceName={envResourceName}
      bindingName={env.bindingName!}
      releaseNames={null}
      canRollback={canRollback}
      deniedTooltip={deniedTooltip}
      canDeleteRevision={canDeleteRevision}
      deleteDeniedTooltip={deleteDeniedTooltip}
      canUpdateBinding={canUpdate}
      updateDeniedTooltip={updateDeniedTooltip}
      onRolledBack={() => void refetch()}
      className={classes.section}
    />
  );
};
