import { useState, useMemo, useCallback, RefObject } from 'react';
import { createPortal } from 'react-dom';
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
  useClusterRoleBindings,
  useClusterRoles,
  ClusterRoleBinding,
} from '../hooks';
import { ClusterRoleBindingRequest } from '../../../api/OpenChoreoClientApi';
import { useNotification } from '../../../hooks';
import { NotificationBanner } from '../../Environments/components';
import { SCOPE_CLUSTER } from '../constants';
import { MappingDialog } from './MappingDialog';

const useStyles = makeStyles(theme => ({
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

interface ClusterRoleBindingsContentProps {
  actionsContainerRef: RefObject<HTMLDivElement>;
}

export const ClusterRoleBindingsContent = ({
  actionsContainerRef,
}: ClusterRoleBindingsContentProps) => {
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
  } = useClusterRoleBindings();
  const { roles } = useClusterRoles();

  const [searchQuery, setSearchQuery] = useState('');
  const [effectFilter, setEffectFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBinding, setEditingBinding] = useState<
    ClusterRoleBinding | undefined
  >(undefined);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [bindingToDelete, setBindingToDelete] =
    useState<ClusterRoleBinding | null>(null);

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

  const handleEditBinding = (binding: ClusterRoleBinding) => {
    setEditingBinding(binding);
    setDialogOpen(true);
  };

  const handleDeleteBinding = (binding: ClusterRoleBinding) => {
    setBindingToDelete(binding);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteBinding = async () => {
    if (!bindingToDelete) return;

    try {
      await deleteBinding(bindingToDelete.name);
      notification.showSuccess(
        `Cluster role binding "${bindingToDelete.name}" deleted successfully`,
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

  const handleSaveBinding = async (binding: ClusterRoleBindingRequest) => {
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
          You do not have permission to view cluster role bindings.
        </Typography>
      </Box>
    );
  }

  const actionButtons = (
    <>
      <IconButton onClick={() => fetchBindings()} size="small" title="Refresh">
        <RefreshIcon />
      </IconButton>
      <Tooltip title={createDeniedTooltip}>
        <span>
          <Button
            variant="contained"
            color="primary"
            size="small"
            startIcon={<AddIcon />}
            onClick={handleCreateBinding}
            disabled={!canCreate}
          >
            New Cluster Role Binding
          </Button>
        </span>
      </Tooltip>
    </>
  );

  return (
    <Box>
      <NotificationBanner notification={notification.notification} />
      {actionsContainerRef.current &&
        createPortal(actionButtons, actionsContainerRef.current)}

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
            onChange={e => handleRoleFilterChange(e.target.value as string)}
            label="Role"
          >
            <MenuItem value="all">All Roles</MenuItem>
            {roles.map(role => (
              <MenuItem key={role.name} value={role.name}>
                {role.name}
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
              ? 'No cluster role bindings match your filters'
              : 'No cluster role bindings defined yet. Create your first binding to grant permissions.'}
          </Typography>
        </Box>
      ) : (
        <TableContainer component={Paper} className={classes.tableContainer}>
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
                    <Typography variant="body2">{binding.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{binding.role.name}</Typography>
                  </TableCell>
                  <TableCell className={classes.entitlementCell}>
                    <Typography variant="body2">
                      {binding.entitlement.claim}={binding.entitlement.value}
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

      <MappingDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onSave={handleSaveBinding}
        availableRoles={roles}
        editingBinding={editingBinding}
        bindingType={SCOPE_CLUSTER}
      />

      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle disableTypography>
          <Typography variant="h4">Delete Cluster Role Binding</Typography>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {bindingToDelete && (
              <>
                Are you sure you want to delete the cluster role binding &nbsp;
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
