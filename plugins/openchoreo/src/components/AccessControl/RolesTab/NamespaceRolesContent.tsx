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
import { Progress } from '@backstage/core-components';
import { useRolePermissions } from '@openchoreo/backstage-plugin-react';
import { useNamespaceRoles, NamespaceRole } from '../hooks';
import type { RoleInput } from './RoleDialog';
import { useNotification } from '../../../hooks';
import { NotificationBanner } from '../../Environments/components';
import { SCOPE_NAMESPACE } from '../constants';
import { RoleDialog } from './RoleDialog';
import { NamespaceSelector } from './NamespaceSelector';
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
  namespaceSelector: {
    marginBottom: theme.spacing(2),
  },
}));

export const NamespaceRolesContent = () => {
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
  const [selectedNamespace, setSelectedNamespace] = useState('');
  const { roles, loading, error, fetchRoles, addRole, updateRole, deleteRole } =
    useNamespaceRoles(selectedNamespace || undefined);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<NamespaceRole | undefined>(
    undefined,
  );

  const handleCreateRole = () => {
    setEditingRole(undefined);
    setDialogOpen(true);
  };

  const handleEditRole = (role: { name: string; actions: string[] }) => {
    setEditingRole({ ...role, namespace: selectedNamespace });
    setDialogOpen(true);
  };

  const handleCheckBindings = async (
    name: string,
  ): Promise<BindingSummary[]> => {
    const result = await client.listBindingsForNamespaceRole(
      selectedNamespace,
      name,
    );
    return result.namespaceRoleBindings.map(b => ({
      name: b.name,
      entitlement: { claim: b.entitlement.claim, value: b.entitlement.value },
      effect: b.effect,
      type: SCOPE_NAMESPACE,
      namespace: b.namespace,
    }));
  };

  const handleDeleteRole = async (name: string) => {
    try {
      await deleteRole(name);
      notification.showSuccess(`Namespace role "${name}" deleted successfully`);
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
    _bindings: BindingSummary[],
  ) => {
    try {
      const result = await client.forceDeleteNamespaceRole(
        selectedNamespace,
        name,
      );

      if (result.roleDeleted) {
        await fetchRoles();
        notification.showSuccess(
          `Namespace role "${name}" and its bindings deleted successfully`,
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

  const handleSaveRole = async (role: RoleInput) => {
    if (editingRole) {
      await updateRole(role.name, { actions: role.actions });
    } else {
      await addRole(role as NamespaceRole);
    }
    setDialogOpen(false);
    setEditingRole(undefined);
  };

  if (permissionsLoading) {
    return <Progress />;
  }

  if (!canView) {
    return (
      <Box className={classes.emptyState}>
        <Typography variant="body1" color="textSecondary">
          You do not have permission to view namespace roles.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <NotificationBanner notification={notification.notification} />
      <Box className={classes.header}>
        <Typography variant="h5">Namespace Roles</Typography>
        <Box className={classes.headerActions}>
          <IconButton
            onClick={fetchRoles}
            size="small"
            title="Refresh"
            disabled={!selectedNamespace}
          >
            <RefreshIcon />
          </IconButton>
          <Tooltip
            title={
              !selectedNamespace
                ? 'Select a namespace first'
                : createDeniedTooltip
            }
          >
            <span>
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={handleCreateRole}
                disabled={!canCreate || !selectedNamespace}
              >
                New Namespace Role
              </Button>
            </span>
          </Tooltip>
        </Box>
      </Box>

      <Box className={classes.namespaceSelector}>
        <NamespaceSelector
          value={selectedNamespace}
          onChange={setSelectedNamespace}
          label="Select Namespace"
        />
      </Box>

      {!selectedNamespace ? (
        <Box className={classes.emptyState}>
          <Typography variant="body1" color="textSecondary">
            Select a namespace to view its roles.
          </Typography>
        </Box>
      ) : (
        <>
          {loading && <Progress />}
          {!loading && error && (
            <Box className={classes.emptyState}>
              <Typography variant="body1" color="textSecondary">
                Failed to load namespace roles.
              </Typography>
            </Box>
          )}
          {!loading && !error && (
            <RolesTable
              roles={roles}
              scope={SCOPE_NAMESPACE}
              scopeLabel="Namespace Role"
              canUpdate={canUpdate}
              canDelete={canDelete}
              updateDeniedTooltip={updateDeniedTooltip}
              deleteDeniedTooltip={deleteDeniedTooltip}
              onEdit={handleEditRole}
              onDelete={handleDeleteRole}
              onCheckBindings={handleCheckBindings}
              onForceDelete={handleForceDelete}
            />
          )}
        </>
      )}

      <RoleDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditingRole(undefined);
        }}
        onSave={handleSaveRole}
        editingRole={editingRole}
        scope={SCOPE_NAMESPACE}
        namespace={selectedNamespace}
      />
    </Box>
  );
};
