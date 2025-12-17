import { useState, useMemo } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import DeleteIcon from '@material-ui/icons/Delete';
import EditIcon from '@material-ui/icons/Edit';
import SearchIcon from '@material-ui/icons/Search';
import RefreshIcon from '@material-ui/icons/Refresh';
import WarningIcon from '@material-ui/icons/Warning';
import { Progress, ResponseErrorPanel } from '@backstage/core-components';
import { useRoles, Role, RoleEntitlementMapping } from '../hooks';
import { RoleDialog } from './RoleDialog';

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
  searchField: {
    width: 300,
    marginBottom: theme.spacing(2),
  },
  tableContainer: {
    marginTop: theme.spacing(2),
  },
  actionsChip: {
    margin: theme.spacing(0.25),
    maxWidth: 150,
  },
  actionsCell: {
    maxWidth: 400,
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing(4),
  },
  warningHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    color: theme.palette.warning.main,
  },
  warningIcon: {
    color: theme.palette.warning.main,
  },
  mappingsList: {
    maxHeight: 200,
    overflow: 'auto',
    backgroundColor: theme.palette.background.default,
    borderRadius: theme.shape.borderRadius,
    marginTop: theme.spacing(2),
  },
  forceDeleteButton: {
    backgroundColor: theme.palette.error.main,
    color: theme.palette.error.contrastText,
    '&:hover': {
      backgroundColor: theme.palette.error.dark,
    },
  },
}));

export const RolesTab = () => {
  const classes = useStyles();
  const {
    roles,
    loading,
    error,
    fetchRoles,
    addRole,
    updateRole,
    deleteRole,
    getRoleMappings,
  } = useRoles();
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | undefined>(undefined);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null);
  const [roleMappings, setRoleMappings] = useState<RoleEntitlementMapping[]>([]);
  const [checkingMappings, setCheckingMappings] = useState(false);

  const filteredRoles = useMemo(() => {
    if (!searchQuery) return roles;
    const query = searchQuery.toLowerCase();
    return roles.filter(
      role =>
        role.name.toLowerCase().includes(query) ||
        role.actions.some(action => action.toLowerCase().includes(query)),
    );
  }, [roles, searchQuery]);

  const handleCreateRole = () => {
    setEditingRole(undefined);
    setDialogOpen(true);
  };

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setDialogOpen(true);
  };

  const handleDeleteRole = async (name: string) => {
    setRoleToDelete(name);
    setCheckingMappings(true);
    setDeleteConfirmOpen(true);

    try {
      const mappings = await getRoleMappings(name);
      setRoleMappings(mappings);
    } catch {
      setRoleMappings([]);
    } finally {
      setCheckingMappings(false);
    }
  };

  const confirmDeleteRole = async (force: boolean = false) => {
    if (roleToDelete) {
      await deleteRole(roleToDelete, force);
    }
    setDeleteConfirmOpen(false);
    setRoleToDelete(null);
    setRoleMappings([]);
  };

  const handleSaveRole = async (role: Role) => {
    if (editingRole) {
      await updateRole(role.name, role.actions);
    } else {
      await addRole(role);
    }
    setDialogOpen(false);
    setEditingRole(undefined);
  };

  const closeDeleteDialog = () => {
    setDeleteConfirmOpen(false);
    setRoleToDelete(null);
    setRoleMappings([]);
  };

  if (loading) {
    return <Progress />;
  }

  if (error) {
    return <ResponseErrorPanel error={error} />;
  }

  return (
    <Box>
      <Box className={classes.header}>
        <Typography variant="h5">Roles</Typography>
        <Box className={classes.headerActions}>
          <IconButton onClick={fetchRoles} size="small" title="Refresh">
            <RefreshIcon />
          </IconButton>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleCreateRole}
          >
            New Role
          </Button>
        </Box>
      </Box>

      <TextField
        className={classes.searchField}
        placeholder="Search roles..."
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

      {filteredRoles.length === 0 ? (
        <Box className={classes.emptyState}>
          <Typography variant="body1" color="textSecondary">
            {searchQuery
              ? 'No roles match your search'
              : 'No roles defined yet. Create your first role to get started.'}
          </Typography>
        </Box>
      ) : (
        <TableContainer component={Paper} className={classes.tableContainer}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Role Name</TableCell>
                <TableCell className={classes.actionsCell}>Actions</TableCell>
                <TableCell align="right">Operations</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRoles.map(role => (
                <TableRow key={role.name}>
                  <TableCell>
                    <Typography variant="body1">{role.name}</Typography>
                  </TableCell>
                  <TableCell className={classes.actionsCell}>
                    {role.actions.length === 0 ? (
                      <Typography variant="body2" color="textSecondary">
                        No actions
                      </Typography>
                    ) : (
                      role.actions
                        .slice(0, 5)
                        .map(action => (
                          <Chip
                            key={action}
                            label={action}
                            size="small"
                            className={classes.actionsChip}
                          />
                        ))
                    )}
                    {role.actions.length > 5 && (
                      <Chip
                        label={`+${role.actions.length - 5} more`}
                        size="small"
                        variant="outlined"
                        className={classes.actionsChip}
                      />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleEditRole(role)}
                      title="Edit"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteRole(role.name)}
                      title="Delete"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <RoleDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditingRole(undefined);
        }}
        onSave={handleSaveRole}
        editingRole={editingRole}
      />

      <Dialog open={deleteConfirmOpen} onClose={closeDeleteDialog} maxWidth="sm" fullWidth>
        {checkingMappings && (
          <>
            <DialogTitle>Checking Role Usage</DialogTitle>
            <DialogContent>
              <Box display="flex" alignItems="center" style={{ gap: 16 }} py={2}>
                <CircularProgress size={24} />
                <Typography>Checking for role mappings...</Typography>
              </Box>
            </DialogContent>
          </>
        )}
        {!checkingMappings && roleMappings.length > 0 && (
          <>
            <DialogTitle>
              <Box className={classes.warningHeader}>
                <WarningIcon className={classes.warningIcon} />
                <span>Role Has Active Mappings</span>
              </Box>
            </DialogTitle>
            <DialogContent>
              <DialogContentText>
                The role "{roleToDelete}" has {roleMappings.length} active mapping
                {roleMappings.length > 1 ? 's' : ''}. Deleting it will also remove
                the following mappings:
              </DialogContentText>
              <List className={classes.mappingsList} dense>
                {roleMappings.map((mapping, index) => (
                  <ListItem key={mapping.id ?? index}>
                    <ListItemText
                      primary={`${mapping.entitlement.claim}=${mapping.entitlement.value}`}
                      secondary={`Effect: ${mapping.effect.toUpperCase()}`}
                    />
                  </ListItem>
                ))}
              </List>
            </DialogContent>
            <DialogActions>
              <Button onClick={closeDeleteDialog}>Cancel</Button>
              <Button
                onClick={() => confirmDeleteRole(true)}
                className={classes.forceDeleteButton}
                variant="contained"
              >
                Force Delete
              </Button>
            </DialogActions>
          </>
        )}
        {!checkingMappings && roleMappings.length === 0 && (
          <>
            <DialogTitle>Delete Role</DialogTitle>
            <DialogContent>
              <DialogContentText>
                Are you sure you want to delete the role "{roleToDelete}"?
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={closeDeleteDialog}>Cancel</Button>
              <Button onClick={() => confirmDeleteRole(false)} color="secondary">
                Delete
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};
