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
  List,
  ListItem,
  ListItemText,
  CircularProgress,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import DeleteIcon from '@material-ui/icons/DeleteOutlined';
import EditIcon from '@material-ui/icons/EditOutlined';
import SearchIcon from '@material-ui/icons/Search';
import WarningIcon from '@material-ui/icons/Warning';

interface RoleRow {
  name: string;
  actions: string[];
  description?: string;
}

export interface BindingSummary {
  name: string;
  entitlement: { claim: string; value: string };
  effect: string;
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
  onCheckBindings: (name: string) => Promise<BindingSummary[]>;
  onForceDelete: (name: string, bindings: BindingSummary[]) => Promise<void>;
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
  warningHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
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
  onCheckBindings,
  onForceDelete,
}: RolesTableProps) => {
  const classes = useStyles();
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null);
  const [activeBindings, setActiveBindings] = useState<BindingSummary[]>([]);
  const [checkingBindings, setCheckingBindings] = useState(false);

  const filteredRoles = useMemo(() => {
    if (!searchQuery) return roles;
    const query = searchQuery.toLowerCase();
    return roles.filter(
      role =>
        role.name.toLowerCase().includes(query) ||
        role.actions.some(action => action.toLowerCase().includes(query)),
    );
  }, [roles, searchQuery]);

  const handleDeleteRole = async (name: string) => {
    setRoleToDelete(name);
    setCheckingBindings(true);
    setDeleteConfirmOpen(true);

    try {
      const bindings = await onCheckBindings(name);
      setActiveBindings(bindings);
    } catch {
      setActiveBindings([]);
    } finally {
      setCheckingBindings(false);
    }
  };

  const closeDeleteDialog = () => {
    setDeleteConfirmOpen(false);
    setRoleToDelete(null);
    setActiveBindings([]);
  };

  const confirmDeleteRole = async () => {
    if (!roleToDelete) return;
    await onDelete(roleToDelete);
    closeDeleteDialog();
  };

  const confirmForceDelete = async () => {
    if (!roleToDelete) return;
    await onForceDelete(roleToDelete, activeBindings);
    closeDeleteDialog();
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
        {checkingBindings && (
          <>
            <DialogTitle disableTypography>
              <Typography variant="h6">Checking {scopeLabel} Usage</Typography>
            </DialogTitle>
            <DialogContent>
              <Box
                display="flex"
                alignItems="center"
                style={{ gap: 16 }}
                py={2}
              >
                <CircularProgress size={24} />
                <Typography>Checking for role bindings...</Typography>
              </Box>
            </DialogContent>
          </>
        )}
        {!checkingBindings && activeBindings.length > 0 && (
          <>
            <DialogTitle disableTypography>
              <Box className={classes.warningHeader}>
                <WarningIcon className={classes.warningIcon} />
                <Typography variant="h4" component="span">
                  {scopeLabel} Has Active Bindings
                </Typography>
              </Box>
            </DialogTitle>
            <DialogContent>
              <DialogContentText>
                The {scopeLabel.toLowerCase()} "{roleToDelete}" has{' '}
                {activeBindings.length} active binding
                {activeBindings.length > 1 ? 's' : ''}. Deleting it will also
                remove the following bindings:
              </DialogContentText>
              <List className={classes.mappingsList} dense>
                {activeBindings.map((binding, index) => (
                  <ListItem key={binding.name ?? index}>
                    <ListItemText
                      primary={`${binding.entitlement.claim}=${binding.entitlement.value}`}
                      secondary={`Effect: ${binding.effect.toUpperCase()}`}
                    />
                  </ListItem>
                ))}
              </List>
            </DialogContent>
            <DialogActions>
              <Button onClick={closeDeleteDialog} variant="contained">
                Cancel
              </Button>
              <Button
                onClick={confirmForceDelete}
                className={classes.deleteButton}
                variant="outlined"
              >
                Force Delete
              </Button>
            </DialogActions>
          </>
        )}
        {!checkingBindings && activeBindings.length === 0 && (
          <>
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
          </>
        )}
      </Dialog>
    </>
  );
};
