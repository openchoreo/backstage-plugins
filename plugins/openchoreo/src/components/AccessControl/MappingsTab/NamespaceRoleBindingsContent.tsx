import { useState, useMemo, useCallback } from 'react';
import {
  Typography,
  Button,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Tooltip,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import DeleteIcon from '@material-ui/icons/DeleteOutlined';
import EditIcon from '@material-ui/icons/EditOutlined';
import SearchIcon from '@material-ui/icons/Search';
import RefreshIcon from '@material-ui/icons/Refresh';
import ClearIcon from '@material-ui/icons/Clear';
import { Progress, ResponseErrorPanel } from '@backstage/core-components';
import { useRoleMappingPermissions } from '@openchoreo/backstage-plugin-react';
import {
  useNamespaceRoleBindings,
  useNamespaceRoles,
  useClusterRoles,
  NamespaceRoleBinding,
  NamespaceRoleBindingRequest,
} from '../hooks';
import { useNotification } from '../../../hooks';
import { NotificationBanner } from '../../Environments/components';
import { NamespaceSelector } from '../RolesTab/NamespaceSelector';
import { SCOPE_NAMESPACE } from '../constants';
import { MappingDialog } from './MappingDialog';

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
  namespaceSelector: {
    marginBottom: theme.spacing(2),
  },
  filters: {
    display: 'flex',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
    flexWrap: 'wrap',
  },
  searchField: {
    width: theme.spacing(40),
  },
  filterSelect: {
    minWidth: 150,
  },
  tableContainer: {
    marginTop: theme.spacing(2),
  },
  entitlementCell: {
    maxWidth: 200,
  },
  effectChip: {
    fontWeight: 600,
  },
  allowChip: {
    borderColor: theme.palette.success.main,
    color: theme.palette.success.main,
  },
  denyChip: {
    borderColor: theme.palette.error.main,
    color: theme.palette.error.main,
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing(4),
  },
  deleteButton: {
    borderColor: theme.palette.error.main,
    color: theme.palette.error.main,
    '&:hover': {
      borderColor: theme.palette.error.dark,
      backgroundColor: 'rgba(211, 47, 47, 0.04)',
    },
  },
}));

export const NamespaceRoleBindingsContent = () => {
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
  } = useRoleMappingPermissions();

  const [selectedNamespace, setSelectedNamespace] = useState('');
  const {
    bindings,
    loading,
    error,
    filters,
    setFilters,
    fetchBindings,
    addBinding,
    updateBinding,
    deleteBinding,
  } = useNamespaceRoleBindings(selectedNamespace || undefined);

  // Get both namespace roles and cluster roles for binding
  const { roles: namespaceRoles, loading: namespaceRolesLoading } =
    useNamespaceRoles(selectedNamespace || undefined);
  const { roles: clusterRoles, loading: clusterRolesLoading } =
    useClusterRoles();

  // Combine roles for the dialog - namespace bindings can reference both.
  // Cluster roles have no namespace field; namespace roles already carry it from the API.
  const availableRoles = useMemo(
    () => [...clusterRoles, ...namespaceRoles],
    [clusterRoles, namespaceRoles],
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [effectFilter, setEffectFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBinding, setEditingBinding] = useState<
    NamespaceRoleBinding | undefined
  >(undefined);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [bindingToDelete, setBindingToDelete] =
    useState<NamespaceRoleBinding | null>(null);

  // Server-side role filter
  const handleRoleFilterChange = useCallback(
    (value: string) => {
      if (value === 'all') {
        setFilters({ ...filters, roleName: undefined });
      } else {
        setFilters({ ...filters, roleName: value });
      }
    },
    [filters, setFilters],
  );

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setFilters({});
    setSearchQuery('');
    setEffectFilter('all');
  }, [setFilters]);

  // Client-side filtering for effect and search
  const filteredBindings = useMemo(() => {
    return bindings.filter(binding => {
      // Effect filter (client-side)
      if (effectFilter !== 'all' && binding.effect !== effectFilter) {
        return false;
      }

      // Search filter (client-side)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchFields = [
          binding.name,
          binding.role.name,
          binding.entitlement.claim,
          binding.entitlement.value,
        ].map(s => s.toLowerCase());

        if (!searchFields.some(field => field.includes(query))) {
          return false;
        }
      }

      return true;
    });
  }, [bindings, searchQuery, effectFilter]);

  const handleCreateBinding = () => {
    setEditingBinding(undefined);
    setDialogOpen(true);
  };

  const handleEditBinding = (binding: NamespaceRoleBinding) => {
    setEditingBinding(binding);
    setDialogOpen(true);
  };

  const handleDeleteBinding = (binding: NamespaceRoleBinding) => {
    setBindingToDelete(binding);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteBinding = async () => {
    if (!bindingToDelete) return;

    try {
      await deleteBinding(bindingToDelete.name);
      notification.showSuccess(
        `Namespace role binding "${bindingToDelete.name}" deleted successfully`,
      );
      setDeleteConfirmOpen(false);
      setBindingToDelete(null);
    } catch (err) {
      notification.showError(
        `Failed to delete binding: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`,
      );
    }
  };

  const handleSaveBinding = async (binding: NamespaceRoleBindingRequest) => {
    if (editingBinding) {
      await updateBinding(editingBinding.name, binding);
    } else {
      await addBinding(binding);
    }
    setDialogOpen(false);
    setEditingBinding(undefined);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingBinding(undefined);
  };

  const hasActiveFilters =
    filters.roleName || searchQuery || effectFilter !== 'all';

  if (permissionsLoading) {
    return <Progress />;
  }

  if (!canView) {
    return (
      <Box className={classes.emptyState}>
        <Typography variant="body1" color="textSecondary">
          You do not have permission to view namespace role bindings.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <NotificationBanner notification={notification.notification} />
      <Box className={classes.header}>
        <Typography variant="h5">Namespace Role Bindings</Typography>
        <Box className={classes.headerActions}>
          <IconButton
            onClick={() => fetchBindings()}
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
                onClick={handleCreateBinding}
                disabled={!canCreate || !selectedNamespace}
              >
                New Namespace Role Binding
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
            Select a namespace to view its role bindings.
          </Typography>
        </Box>
      ) : (
        <>
          {loading ||
            namespaceRolesLoading ||
            (clusterRolesLoading && <Progress />)}
          {!loading &&
            !namespaceRolesLoading &&
            !clusterRolesLoading &&
            error && <ResponseErrorPanel error={error} />}
          {!loading &&
            !namespaceRolesLoading &&
            !clusterRolesLoading &&
            !error && (
              <>
                <Box className={classes.filters}>
                  <TextField
                    className={classes.searchField}
                    placeholder="Search..."
                    variant="outlined"
                    size="small"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                    }}
                  />

                  <FormControl
                    variant="outlined"
                    size="small"
                    className={classes.filterSelect}
                  >
                    <InputLabel>Role</InputLabel>
                    <Select
                      value={filters.roleName || 'all'}
                      onChange={e =>
                        handleRoleFilterChange(e.target.value as string)
                      }
                      label="Role"
                    >
                      <MenuItem value="all">All Roles</MenuItem>
                      {availableRoles.map(role => (
                        <MenuItem
                          key={`${role.name}-${role.namespace || ''}`}
                          value={role.name}
                        >
                          {role.name}{' '}
                          {role.namespace ? '(Namespace)' : '(Cluster)'}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl
                    variant="outlined"
                    size="small"
                    className={classes.filterSelect}
                  >
                    <InputLabel>Effect</InputLabel>
                    <Select
                      value={effectFilter}
                      onChange={e => setEffectFilter(e.target.value as string)}
                      label="Effect"
                    >
                      <MenuItem value="all">All Effects</MenuItem>
                      <MenuItem value="allow">Allow</MenuItem>
                      <MenuItem value="deny">Deny</MenuItem>
                    </Select>
                  </FormControl>

                  {hasActiveFilters && (
                    <Button
                      size="small"
                      startIcon={<ClearIcon />}
                      onClick={handleClearFilters}
                    >
                      Clear Filters
                    </Button>
                  )}
                </Box>

                {filteredBindings.length === 0 ? (
                  <Box className={classes.emptyState}>
                    <Typography variant="body1" color="textSecondary">
                      {hasActiveFilters
                        ? 'No namespace role bindings match your filters'
                        : 'No namespace role bindings defined yet. Create your first binding to grant permissions.'}
                    </Typography>
                  </Box>
                ) : (
                  <TableContainer
                    component={Paper}
                    className={classes.tableContainer}
                  >
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Binding Name</TableCell>
                          <TableCell>Role</TableCell>
                          <TableCell className={classes.entitlementCell}>
                            Entitlement (claim=value)
                          </TableCell>
                          <TableCell>Effect</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredBindings.map(binding => (
                          <TableRow key={binding.name}>
                            <TableCell>
                              <Typography variant="body2">
                                {binding.name}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {binding.role.name}
                                {binding.role.namespace && (
                                  <Chip
                                    label="Namespace"
                                    size="small"
                                    variant="outlined"
                                    style={{ marginLeft: 8 }}
                                  />
                                )}
                                {!binding.role.namespace && (
                                  <Chip
                                    label="Cluster"
                                    size="small"
                                    variant="outlined"
                                    style={{ marginLeft: 8 }}
                                  />
                                )}
                              </Typography>
                            </TableCell>
                            <TableCell className={classes.entitlementCell}>
                              <Typography variant="body2">
                                {binding.entitlement.claim}=
                                {binding.entitlement.value}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={binding.effect.toUpperCase()}
                                size="small"
                                variant="outlined"
                                className={`${classes.effectChip} ${
                                  binding.effect === 'allow'
                                    ? classes.allowChip
                                    : classes.denyChip
                                }`}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Tooltip title={updateDeniedTooltip}>
                                <span>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleEditBinding(binding)}
                                    title="Edit"
                                    disabled={!canUpdate}
                                    color="primary"
                                  >
                                    <EditIcon />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title={deleteDeniedTooltip}>
                                <span>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDeleteBinding(binding)}
                                    title="Delete"
                                    disabled={!canDelete}
                                    color="primary"
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </>
            )}
        </>
      )}

      <MappingDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onSave={handleSaveBinding}
        availableRoles={availableRoles}
        editingBinding={editingBinding}
        bindingType={SCOPE_NAMESPACE}
        namespace={selectedNamespace}
      />

      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle disableTypography>
          <Typography variant="h4">Delete Namespace Role Binding</Typography>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {bindingToDelete && (
              <>
                Are you sure you want to delete the namespace role binding
                &nbsp;
                <strong>{bindingToDelete.name}</strong>?
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteConfirmOpen(false)}
            variant="contained"
          >
            Cancel
          </Button>
          <Button
            onClick={confirmDeleteBinding}
            variant="outlined"
            className={classes.deleteButton}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
