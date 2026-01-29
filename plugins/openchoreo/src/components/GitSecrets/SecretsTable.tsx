import React, { useState } from 'react';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  IconButton,
  Tooltip,
  Typography,
  Box,
  Button,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
} from '@material-ui/core';
import DeleteIcon from '@material-ui/icons/Delete';
import SearchIcon from '@material-ui/icons/Search';
import AddIcon from '@material-ui/icons/Add';
import { makeStyles } from '@material-ui/core/styles';
import { GitSecret } from '../../api/OpenChoreoClientApi';

const useStyles = makeStyles(theme => ({
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
  },
  searchField: {
    width: 300,
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing(4),
  },
  table: {
    '& .MuiTableCell-head': {
      fontWeight: 600,
    },
  },
}));

interface SecretsTableProps {
  secrets: GitSecret[];
  loading: boolean;
  onDelete: (secretName: string) => Promise<void>;
  onCreateClick: () => void;
  namespaceName: string;
}

export const SecretsTable: React.FC<SecretsTableProps> = ({
  secrets,
  loading,
  onDelete,
  onCreateClick,
  namespaceName,
}) => {
  const classes = useStyles();
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [secretToDelete, setSecretToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const filteredSecrets = secrets.filter(secret =>
    secret.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleDeleteClick = (secretName: string) => {
    setSecretToDelete(secretName);
    setDeleteDialogOpen(true);
    setDeleteError(null);
  };

  const handleDeleteConfirm = async () => {
    if (!secretToDelete) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      await onDelete(secretToDelete);
      setDeleteDialogOpen(false);
      setSecretToDelete(null);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'Failed to delete secret',
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    if (!deleting) {
      setDeleteDialogOpen(false);
      setSecretToDelete(null);
      setDeleteError(null);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Box className={classes.toolbar}>
        <TextField
          className={classes.searchField}
          placeholder="Search secrets..."
          variant="outlined"
          size="small"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
        />
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={onCreateClick}
        >
          Create Secret
        </Button>
      </Box>

      {filteredSecrets.length === 0 ? (
        <Box className={classes.emptyState}>
          <Typography variant="h6" color="textSecondary">
            {searchQuery
              ? 'No secrets match your search'
              : `No git secrets in namespace ${namespaceName}`}
          </Typography>
          {!searchQuery && (
            <Typography variant="body2" color="textSecondary">
              Create a git secret to access private repositories
            </Typography>
          )}
        </Box>
      ) : (
        <Table className={classes.table}>
          <TableHead>
            <TableRow>
              <TableCell>Secret Name</TableCell>
              <TableCell>Namespace</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredSecrets.map(secret => (
              <TableRow key={secret.name}>
                <TableCell>{secret.name}</TableCell>
                <TableCell>{secret.namespace}</TableCell>
                <TableCell align="right">
                  <Tooltip title="Delete secret">
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteClick(secret.name)}
                      color="secondary"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
        <DialogTitle>Delete Git Secret</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the git secret{' '}
            <strong>{secretToDelete}</strong>? This action cannot be undone.
          </DialogContentText>
          <DialogContentText color="error" style={{ marginTop: 16 }}>
            Warning: Any components using this secret will lose access to their
            private repositories.
          </DialogContentText>
          {deleteError && (
            <Typography color="error" style={{ marginTop: 16 }}>
              {deleteError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleting}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="secondary"
            variant="contained"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={20} /> : null}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
