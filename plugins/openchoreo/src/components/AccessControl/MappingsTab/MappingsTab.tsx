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
  Popover,
  Tooltip,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import DeleteIcon from '@material-ui/icons/DeleteOutlined';
import EditIcon from '@material-ui/icons/EditOutlined';
import SearchIcon from '@material-ui/icons/Search';
import RefreshIcon from '@material-ui/icons/Refresh';
import ClearIcon from '@material-ui/icons/Clear';
import FilterListIcon from '@material-ui/icons/FilterList';
import { Progress, ResponseErrorPanel } from '@backstage/core-components';
import { useRoleMappingPermissions } from '@openchoreo/backstage-plugin-react';
import {
  useMappings,
  useRoles,
  RoleEntitlementMapping,
  ResourceHierarchy,
} from '../hooks';
import { useNotification } from '../../../hooks';
import { NotificationBanner } from '../../Environments/components';
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
  entitlementFilterChip: {
    cursor: 'pointer',
  },
  entitlementPopover: {
    padding: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    minWidth: 280,
  },
  entitlementPopoverActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
  tableContainer: {
    marginTop: theme.spacing(2),
  },
  hierarchyCell: {
    maxWidth: 250,
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

const formatHierarchy = (hierarchy: ResourceHierarchy): string => {
  const parts: string[] = [];
  if (hierarchy.organization) parts.push(`org/${hierarchy.organization}`);
  if (hierarchy.organization_units?.length) {
    parts.push(`units/${hierarchy.organization_units.join('/')}`);
  }
  if (hierarchy.project) parts.push(`project/${hierarchy.project}`);
  if (hierarchy.component) parts.push(`component/${hierarchy.component}`);
  return parts.join(' > ') || 'Global';
};

export const MappingsTab = () => {
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
    mappings,
    loading,
    error,
    filters,
    setFilters,
    fetchMappings,
    addMapping,
    updateMapping,
    deleteMapping,
  } = useMappings();
  const { roles } = useRoles();

  const [searchQuery, setSearchQuery] = useState('');
  const [effectFilter, setEffectFilter] = useState<string>('all');
  const [claimFilter, setClaimFilter] = useState('');
  const [valueFilter, setValueFilter] = useState('');
  const [entitlementPopoverAnchor, setEntitlementPopoverAnchor] =
    useState<HTMLElement | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<
    RoleEntitlementMapping | undefined
  >(undefined);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [mappingToDelete, setMappingToDelete] =
    useState<RoleEntitlementMapping | null>(null);

  // Server-side role filter
  const handleRoleFilterChange = useCallback(
    (value: string) => {
      if (value === 'all') {
        setFilters({ ...filters, role: undefined });
      } else {
        setFilters({ ...filters, role: value });
      }
    },
    [filters, setFilters],
  );

  // Entitlement filter popover handlers
  const handleOpenEntitlementPopover = (
    event: React.MouseEvent<HTMLElement>,
  ) => {
    setEntitlementPopoverAnchor(event.currentTarget);
  };

  const handleCloseEntitlementPopover = () => {
    setEntitlementPopoverAnchor(null);
  };

  const handleApplyEntitlementFilter = () => {
    if (claimFilter && valueFilter) {
      setFilters({ ...filters, claim: claimFilter, value: valueFilter });
    }
    handleCloseEntitlementPopover();
  };

  const handleClearEntitlementFilter = () => {
    setClaimFilter('');
    setValueFilter('');
    const { claim: _c, value: _v, ...rest } = filters;
    setFilters(rest);
  };

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setFilters({});
    setSearchQuery('');
    setEffectFilter('all');
    setClaimFilter('');
    setValueFilter('');
  }, [setFilters]);

  // Client-side filtering for effect and search (not supported by API)
  const filteredMappings = useMemo(() => {
    return mappings.filter(mapping => {
      // Effect filter (client-side)
      if (effectFilter !== 'all' && mapping.effect !== effectFilter) {
        return false;
      }

      // Search filter (client-side)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchFields = [
          mapping.role_name,
          mapping.entitlement.claim,
          mapping.entitlement.value,
          formatHierarchy(mapping.hierarchy),
        ].map(s => s.toLowerCase());

        if (!searchFields.some(field => field.includes(query))) {
          return false;
        }
      }

      return true;
    });
  }, [mappings, searchQuery, effectFilter]);

  const handleCreateMapping = () => {
    setEditingMapping(undefined);
    setDialogOpen(true);
  };

  const handleEditMapping = (mapping: RoleEntitlementMapping) => {
    setEditingMapping(mapping);
    setDialogOpen(true);
  };

  const handleDeleteMapping = (mapping: RoleEntitlementMapping) => {
    setMappingToDelete(mapping);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteMapping = async () => {
    if (mappingToDelete?.id === undefined) return;

    try {
      await deleteMapping(mappingToDelete.id);
      notification.showSuccess(
        `Mapping for role "${mappingToDelete.role_name}" deleted successfully`,
      );
      setDeleteConfirmOpen(false);
      setMappingToDelete(null);
    } catch (err) {
      notification.showError(
        `Failed to delete mapping: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`,
      );
    }
  };

  const handleSaveMapping = async (mapping: RoleEntitlementMapping) => {
    if (editingMapping?.id !== undefined) {
      await updateMapping(editingMapping.id, mapping);
    } else {
      await addMapping(mapping);
    }
    setDialogOpen(false);
    setEditingMapping(undefined);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingMapping(undefined);
  };

  const hasActiveFilters =
    filters.role || filters.claim || searchQuery || effectFilter !== 'all';

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
          You do not have permission to view role mappings.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <NotificationBanner notification={notification.notification} />
      <Box className={classes.header}>
        <Typography variant="h5">Role Mappings</Typography>
        <Box className={classes.headerActions}>
          <IconButton
            onClick={() => fetchMappings()}
            size="small"
            title="Refresh"
          >
            <RefreshIcon />
          </IconButton>
          <Tooltip title={createDeniedTooltip}>
            <span>
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={handleCreateMapping}
                disabled={!canCreate}
              >
                New Mapping
              </Button>
            </span>
          </Tooltip>
        </Box>
      </Box>

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
            value={filters.role || 'all'}
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

        {filters.claim && filters.value ? (
          <Chip
            className={classes.entitlementFilterChip}
            icon={<FilterListIcon />}
            label={`${filters.claim}=${filters.value}`}
            onClick={handleOpenEntitlementPopover}
            onDelete={handleClearEntitlementFilter}
            color="primary"
            variant="outlined"
          />
        ) : (
          <Button
            size="small"
            startIcon={<FilterListIcon />}
            onClick={handleOpenEntitlementPopover}
            variant="outlined"
          >
            Entitlement
          </Button>
        )}

        <Popover
          open={Boolean(entitlementPopoverAnchor)}
          anchorEl={entitlementPopoverAnchor}
          onClose={handleCloseEntitlementPopover}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'left',
          }}
        >
          <Box className={classes.entitlementPopover}>
            <Typography variant="subtitle2">Filter by Entitlement</Typography>
            <TextField
              label="Claim"
              placeholder="e.g., groups"
              variant="outlined"
              size="small"
              value={claimFilter}
              onChange={e => setClaimFilter(e.target.value)}
              fullWidth
            />
            <TextField
              label="Value"
              placeholder="e.g., platform-team"
              variant="outlined"
              size="small"
              value={valueFilter}
              onChange={e => setValueFilter(e.target.value)}
              fullWidth
            />
            <Box className={classes.entitlementPopoverActions}>
              <Button size="small" onClick={handleCloseEntitlementPopover}>
                Cancel
              </Button>
              <Button
                size="small"
                variant="contained"
                color="primary"
                onClick={handleApplyEntitlementFilter}
                disabled={!claimFilter || !valueFilter}
              >
                Apply
              </Button>
            </Box>
          </Box>
        </Popover>

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

      {filteredMappings.length === 0 ? (
        <Box className={classes.emptyState}>
          <Typography variant="body1" color="textSecondary">
            {hasActiveFilters
              ? 'No mappings match your filters'
              : 'No role mappings defined yet. Create your first mapping to grant permissions.'}
          </Typography>
        </Box>
      ) : (
        <TableContainer component={Paper} className={classes.tableContainer}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Role</TableCell>
                <TableCell className={classes.entitlementCell}>
                  Entitlement (claim=value)
                </TableCell>
                <TableCell className={classes.hierarchyCell}>
                  Hierarchy (Scope)
                </TableCell>
                <TableCell>Effect</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredMappings.map((mapping, index) => (
                <TableRow key={mapping.id ?? `${mapping.role_name}-${index}`}>
                  <TableCell>
                    <Typography variant="body2">{mapping.role_name}</Typography>
                  </TableCell>
                  <TableCell className={classes.entitlementCell}>
                    <Typography variant="body2">
                      {mapping.entitlement.claim}={mapping.entitlement.value}
                    </Typography>
                  </TableCell>
                  <TableCell className={classes.hierarchyCell}>
                    <Typography variant="body2">
                      {formatHierarchy(mapping.hierarchy)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={mapping.effect.toUpperCase()}
                      size="small"
                      variant="outlined"
                      className={`${classes.effectChip} ${
                        mapping.effect === 'allow'
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
                          onClick={() => handleEditMapping(mapping)}
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
                          onClick={() => handleDeleteMapping(mapping)}
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
        onSave={handleSaveMapping}
        availableRoles={roles}
        editingMapping={editingMapping}
      />

      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle disableTypography>
          <Typography variant="h4">Delete Role Mapping</Typography>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {mappingToDelete && (
              <>
                Are you sure you want to delete the mapping for role &nbsp;
                <strong>{mappingToDelete.role_name}</strong> with entitlement
                &nbsp;
                <strong>
                  {mappingToDelete.entitlement.claim}=
                  {mappingToDelete.entitlement.value}
                </strong>
                ?
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
            onClick={confirmDeleteMapping}
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
