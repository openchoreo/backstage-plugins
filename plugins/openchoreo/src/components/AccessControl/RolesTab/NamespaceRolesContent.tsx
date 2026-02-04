import { useState } from 'react';
import { Typography, Button, Box, IconButton, Tooltip } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import RefreshIcon from '@material-ui/icons/Refresh';
import { Progress } from '@backstage/core-components';
import { useRolePermissions } from '@openchoreo/backstage-plugin-react';
import { useNamespaceRoles, NamespaceRole } from '../hooks';
import { useNotification } from '../../../hooks';
import { NotificationBanner } from '../../Environments/components';
import { SCOPE_NAMESPACE } from '../constants';
import { RoleDialog } from './RoleDialog';
import { NamespaceSelector } from './NamespaceSelector';
import { RolesTable } from './RolesTable';

const useStyles = makeStyles(theme => ({
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
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

  const [selectedNamespace, setSelectedNamespace] = useState('');
  const { roles, loading, error, fetchRoles, addRole, updateRole, deleteRole } =
    useNamespaceRoles(selectedNamespace || undefined);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<NamespaceRole | undefined>(undefined);

  const handleCreateRole = () => {
    setEditingRole(undefined);
    setDialogOpen(true);
  };

  const handleEditRole = (role: { name: string; actions: string[] }) => {
    setEditingRole({ ...role, namespace: selectedNamespace } as NamespaceRole);
    setDialogOpen(true);
  };

  const handleDeleteRole = async (name: string) => {
    try {
      await deleteRole(name);
      notification.showSuccess(`Namespace role "${name}" deleted successfully`);
    } catch (err) {
      notification.showError(
        `Failed to delete role: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  };

  const handleSaveRole = async (role: { name: string; actions: string[]; namespace?: string }) => {
    if (editingRole) {
      await updateRole(role.name, { actions: role.actions });
    } else {
      await addRole({ ...role, namespace: selectedNamespace } as NamespaceRole);
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
            title={!selectedNamespace ? 'Select a namespace first' : createDeniedTooltip}
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
              scopeLabel="Namespace Role"
              canUpdate={canUpdate}
              canDelete={canDelete}
              updateDeniedTooltip={updateDeniedTooltip}
              deleteDeniedTooltip={deleteDeniedTooltip}
              onEdit={handleEditRole}
              onDelete={handleDeleteRole}
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
