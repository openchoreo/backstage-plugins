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
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import DeleteIcon from '@material-ui/icons/Delete';
import EditIcon from '@material-ui/icons/Edit';
import SearchIcon from '@material-ui/icons/Search';
import RefreshIcon from '@material-ui/icons/Refresh';
import { Progress, ResponseErrorPanel } from '@backstage/core-components';
import { useRoles, Role } from '../hooks';
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
}));

export const RolesTab = () => {
  const classes = useStyles();
  const { roles, loading, error, fetchRoles, addRole, deleteRole } = useRoles();
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | undefined>(undefined);

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
    if (window.confirm(`Are you sure you want to delete the role "${name}"?`)) {
      await deleteRole(name);
    }
  };

  const handleSaveRole = async (role: Role) => {
    await addRole(role);
    setDialogOpen(false);
    setEditingRole(undefined);
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
                      role.actions.slice(0, 5).map(action => (
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
    </Box>
  );
};
