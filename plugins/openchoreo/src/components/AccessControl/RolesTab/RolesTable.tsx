import { useState, useMemo } from 'react';
import {
  Typography,
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
  Button,
  Tooltip,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import DeleteIcon from '@material-ui/icons/DeleteOutlined';
import EditIcon from '@material-ui/icons/EditOutlined';
import SearchIcon from '@material-ui/icons/Search';

interface RoleRow {
  name: string;
  actions: string[];
  description?: string;
}

interface RolesTableProps {
  roles: RoleRow[];
  scopeLabel: string;
  canUpdate: boolean;
  canDelete: boolean;
  updateDeniedTooltip: string;
  deleteDeniedTooltip: string;
  onEdit: (role: RoleRow) => void;
  onDelete: (name: string) => Promise<void>;
}

const useStyles = makeStyles(theme => ({
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
  deleteButton: {
    borderColor: theme.palette.error.main,
    color: theme.palette.error.main,
    '&:hover': {
      borderColor: theme.palette.error.dark,
      backgroundColor: 'rgba(211, 47, 47, 0.04)',
    },
  },
}));

export const RolesTable = ({
  roles,
  scopeLabel,
  canUpdate,
  canDelete,
  updateDeniedTooltip,
  deleteDeniedTooltip,
  onEdit,
  onDelete,
}: RolesTableProps) => {
  const classes = useStyles();
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null);

  const filteredRoles = useMemo(() => {
    if (!searchQuery) return roles;
    const query = searchQuery.toLowerCase();
    return roles.filter(
      role =>
        role.name.toLowerCase().includes(query) ||
        role.actions.some(action => action.toLowerCase().includes(query)),
    );
  }, [roles, searchQuery]);

  const handleDeleteRole = (name: string) => {
    setRoleToDelete(name);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteRole = async () => {
    if (!roleToDelete) return;
    await onDelete(roleToDelete);
    setDeleteConfirmOpen(false);
    setRoleToDelete(null);
  };

  const closeDeleteDialog = () => {
    setDeleteConfirmOpen(false);
    setRoleToDelete(null);
  };

  return (
    <>
      <TextField
        className={classes.searchField}
        placeholder={`Search ${scopeLabel.toLowerCase()}s...`}
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
              ? `No ${scopeLabel.toLowerCase()}s match your search`
              : `No ${scopeLabel.toLowerCase()}s defined yet. Create your first ${scopeLabel.toLowerCase()} to get started.`}
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
                    {role.description && (
                      <Typography variant="body2" color="textSecondary">
                        {role.description}
                      </Typography>
                    )}
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
                    <Tooltip title={updateDeniedTooltip}>
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => onEdit(role)}
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
                          onClick={() => handleDeleteRole(role.name)}
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

      <Dialog
        open={deleteConfirmOpen}
        onClose={closeDeleteDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle disableTypography>
          <Typography variant="h4">Delete {scopeLabel}</Typography>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the {scopeLabel.toLowerCase()} "
            {roleToDelete}"?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteDialog} variant="contained">
            Cancel
          </Button>
          <Button
            onClick={confirmDeleteRole}
            variant="outlined"
            className={classes.deleteButton}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
