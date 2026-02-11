import { useState } from 'react';
import {
  Typography,
  Button,
  Box,
  IconButton,
  Tooltip,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import RefreshIcon from '@material-ui/icons/Refresh';
import { Progress, ResponseErrorPanel } from '@backstage/core-components';
import { useRolePermissions } from '@openchoreo/backstage-plugin-react';
import { useClusterRoles, ClusterRole } from '../hooks';
import { useNotification } from '../../../hooks';
import { NotificationBanner } from '../../Environments/components';
import { SCOPE_CLUSTER, SCOPE_NAMESPACE } from '../constants';
import { RoleDialog } from './RoleDialog';
import { RolesTable, BindingSummary } from './RolesTable';
import { useApi } from '@backstage/core-plugin-api';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';

const useStyles = makeStyles(theme => ({
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing(3),
  },
  headerActions: {
    display: 'flex',
    gap: theme.spacing(1),
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing(4),
  },
}));

export const ClusterRolesContent = () => {
  const classes = useStyles();
  const notification = useNotification();
  const {
    canView,
    canCreate,
    canUpdate,
    canDelete,
    loading: permissionsLoading,
    createDeniedTooltip,
    updateDeniedTooltip,
    deleteDeniedTooltip,
  } = useRolePermissions();
  const client = useApi(openChoreoClientApiRef);
  const { roles, loading, error, fetchRoles, addRole, updateRole, deleteRole } =
    useClusterRoles();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<ClusterRole | undefined>(
    undefined,
  );

  const handleCreateRole = () => {
    setEditingRole(undefined);
    setDialogOpen(true);
  };

  const handleEditRole = (role: { name: string; actions: string[] }) => {
    setEditingRole(role as ClusterRole);
    setDialogOpen(true);
  };

  const handleCheckBindings = async (
    name: string,
  ): Promise<BindingSummary[]> => {
    const result = await client.listBindingsForClusterRole(name);
    const clusterSummaries: BindingSummary[] = result.clusterRoleBindings.map(
      b => ({
        name: b.name,
        entitlement: {
          claim: b.entitlement.claim,
          value: b.entitlement.value,
        },
        effect: b.effect,
        type: SCOPE_CLUSTER,
      }),
    );
    const nsSummaries: BindingSummary[] = result.namespaceRoleBindings.map(
      b => ({
        name: b.name,
        entitlement: {
          claim: b.entitlement.claim,
          value: b.entitlement.value,
        },
        effect: b.effect,
        type: SCOPE_NAMESPACE,
        namespace: b.namespace,
      }),
    );
    return [...clusterSummaries, ...nsSummaries];
  };

  const handleDeleteRole = async (name: string) => {
    try {
      await deleteRole(name);
      notification.showSuccess(`Cluster role "${name}" deleted successfully`);
    } catch (err) {
      notification.showError(
        `Failed to delete role: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`,
      );
    }
  };

  const handleForceDelete = async (
    name: string,
    bindings: BindingSummary[],
  ) => {
    try {
      const clusterRoleBindings = bindings
        .filter(b => b.type === SCOPE_CLUSTER)
        .map(b => b.name);
      const namespaceRoleBindings = bindings
        .filter(b => b.type === SCOPE_NAMESPACE)
        .map(b => ({ namespace: b.namespace!, name: b.name }));

      const result = await client.forceDeleteClusterRole(name, {
        clusterRoleBindings,
        namespaceRoleBindings,
      });

      if (result.roleDeleted) {
        await fetchRoles();
        notification.showSuccess(
          `Cluster role "${name}" and its bindings deleted successfully`,
        );
      } else {
        const failedNames = result.failedBindings.map(f => f.name).join(', ');
        notification.showError(
          `Role not deleted. Failed to remove binding(s): ${failedNames}`,
        );
      }
    } catch (err) {
      notification.showError(
        `Failed to delete role: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`,
      );
    }
  };

  const handleSaveRole = async (role: ClusterRole) => {
    if (editingRole) {
      await updateRole(role.name, { actions: role.actions });
    } else {
      await addRole(role);
    }
    setDialogOpen(false);
    setEditingRole(undefined);
  };

  if (loading || permissionsLoading) {
    return <Progress />;
  }

  if (error) {
    return <ResponseErrorPanel error={error} />;
  }

  if (!canView) {
    return (
      <Box className={classes.emptyState}>
        <Typography variant="body1" color="textSecondary">
          You do not have permission to view cluster roles.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <NotificationBanner notification={notification.notification} />
      <Box className={classes.header}>
        <Typography variant="h5">Cluster Roles</Typography>
        <Box className={classes.headerActions}>
          <IconButton onClick={fetchRoles} size="small" title="Refresh">
            <RefreshIcon />
          </IconButton>
          <Tooltip title={createDeniedTooltip}>
            <span>
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={handleCreateRole}
                disabled={!canCreate}
              >
                New Cluster Role
              </Button>
            </span>
          </Tooltip>
        </Box>
      </Box>

      <RolesTable
        roles={roles}
        scope={SCOPE_CLUSTER}
        scopeLabel="Cluster Roles"
        canUpdate={canUpdate}
        canDelete={canDelete}
        updateDeniedTooltip={updateDeniedTooltip}
        deleteDeniedTooltip={deleteDeniedTooltip}
        onEdit={handleEditRole}
        onDelete={handleDeleteRole}
        onCheckBindings={handleCheckBindings}
        onForceDelete={handleForceDelete}
      />

      <RoleDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditingRole(undefined);
        }}
        onSave={handleSaveRole}
        editingRole={editingRole}
        scope={SCOPE_CLUSTER}
      />
    </Box>
  );
};
