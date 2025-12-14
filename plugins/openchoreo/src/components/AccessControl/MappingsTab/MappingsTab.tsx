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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import DeleteIcon from '@material-ui/icons/Delete';
import SearchIcon from '@material-ui/icons/Search';
import RefreshIcon from '@material-ui/icons/Refresh';
import { Progress, ResponseErrorPanel } from '@backstage/core-components';
import {
  useMappings,
  useRoles,
  RoleEntitlementMapping,
  ResourceHierarchy,
} from '../hooks';
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
    width: 200,
  },
  filterSelect: {
    minWidth: 150,
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
    backgroundColor: theme.palette.success.light,
    color: theme.palette.success.contrastText,
  },
  denyChip: {
    backgroundColor: theme.palette.error.light,
    color: theme.palette.error.contrastText,
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing(4),
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
  const { mappings, loading, error, fetchMappings, addMapping, deleteMapping } =
    useMappings();
  const { roles } = useRoles();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [effectFilter, setEffectFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [mappingToDelete, setMappingToDelete] =
    useState<RoleEntitlementMapping | null>(null);

  const filteredMappings = useMemo(() => {
    return mappings.filter(mapping => {
      // Role filter
      if (roleFilter !== 'all' && mapping.role_name !== roleFilter) {
        return false;
      }

      // Effect filter
      if (effectFilter !== 'all' && mapping.effect !== effectFilter) {
        return false;
      }

      // Search filter
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
  }, [mappings, searchQuery, roleFilter, effectFilter]);

  const handleCreateMapping = () => {
    setDialogOpen(true);
  };

  const handleDeleteMapping = (mapping: RoleEntitlementMapping) => {
    setMappingToDelete(mapping);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteMapping = async () => {
    if (mappingToDelete) {
      await deleteMapping(mappingToDelete);
    }
    setDeleteConfirmOpen(false);
    setMappingToDelete(null);
  };

  const handleSaveMapping = async (mapping: RoleEntitlementMapping) => {
    await addMapping(mapping);
    setDialogOpen(false);
  };

  if (loading) {
    return <Progress />;
  }

  if (error) {
    return <ResponseErrorPanel error={error} />;
  }

  const uniqueRoles = [...new Set(mappings.map(m => m.role_name))];

  return (
    <Box>
      <Box className={classes.header}>
        <Typography variant="h5">Role Mappings</Typography>
        <Box className={classes.headerActions}>
          <IconButton onClick={fetchMappings} size="small" title="Refresh">
            <RefreshIcon />
          </IconButton>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleCreateMapping}
          >
            New Mapping
          </Button>
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
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value as string)}
            label="Role"
          >
            <MenuItem value="all">All Roles</MenuItem>
            {uniqueRoles.map(role => (
              <MenuItem key={role} value={role}>
                {role}
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
      </Box>

      {filteredMappings.length === 0 ? (
        <Box className={classes.emptyState}>
          <Typography variant="body1" color="textSecondary">
            {searchQuery || roleFilter !== 'all' || effectFilter !== 'all'
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
                <TableRow
                  key={`${mapping.role_name}-${mapping.entitlement.value}-${index}`}
                >
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
                      className={`${classes.effectChip} ${
                        mapping.effect === 'allow'
                          ? classes.allowChip
                          : classes.denyChip
                      }`}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteMapping(mapping)}
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

      <MappingDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSaveMapping}
        availableRoles={roles}
      />

      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle>Delete Role Mapping</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {mappingToDelete && (
              <>
                Are you sure you want to delete the mapping for role "
                {mappingToDelete.role_name}" with entitlement "
                {mappingToDelete.entitlement.claim}=
                {mappingToDelete.entitlement.value}"?
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={confirmDeleteMapping} color="secondary">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
