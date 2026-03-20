import { useState, useMemo } from 'react';
import {
  IconButton,
  Tooltip,
  Typography,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  InputAdornment,
} from '@material-ui/core';
import { Progress } from '@backstage/core-components';
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';
import VpnKeyOutlinedIcon from '@material-ui/icons/VpnKeyOutlined';
import SearchIcon from '@material-ui/icons/Search';
import { makeStyles } from '@material-ui/core/styles';
import { GitSecret } from '../../api/OpenChoreoClientApi';
import { isForbiddenError, getErrorMessage } from '../../utils/errorUtils';

const useStyles = makeStyles(theme => ({
  searchField: {
    width: 300,
    marginBottom: theme.spacing(2),
  },
  tableContainer: {
    marginTop: theme.spacing(2),
  },
  nameCell: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  nameIcon: {
    color: theme.palette.text.secondary,
    fontSize: '1.2rem',
  },
  scopeChip: {
    height: 22,
    fontSize: '0.75rem',
    fontWeight: 500,
  },
  deleteButton: {
    color: theme.palette.text.secondary,
    '&:hover': {
      color: theme.palette.error.main,
      backgroundColor: 'rgba(244, 67, 54, 0.08)',
    },
  },
  confirmDeleteButton: {
    borderColor: theme.palette.error.main,
    color: theme.palette.error.main,
    '&:hover': {
      borderColor: theme.palette.error.dark,
      backgroundColor: 'rgba(211, 47, 47, 0.04)',
    },
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing(6, 2),
  },
  emptyStateIcon: {
    fontSize: 48,
    color: theme.palette.text.disabled,
    marginBottom: theme.spacing(1),
  },
}));

interface SecretsTableProps {
  secrets: GitSecret[];
  loading: boolean;
  onDelete: (secretName: string) => Promise<void>;
  namespaceName: string;
}

export const SecretsTable = ({
  secrets,
  loading,
  onDelete,
  namespaceName,
}: SecretsTableProps) => {
  const classes = useStyles();
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [secretToDelete, setSecretToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const filteredSecrets = useMemo(() => {
    if (!searchQuery) return secrets;
    const query = searchQuery.toLowerCase();
    return secrets.filter(
      secret =>
        secret.name.toLowerCase().includes(query) ||
        (secret.workflowPlaneName &&
          secret.workflowPlaneName.toLowerCase().includes(query)),
    );
  }, [secrets, searchQuery]);

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
      if (isForbiddenError(err)) {
        setDeleteError(
          'You do not have permission to delete this secret. Contact your administrator.',
        );
      } else {
        setDeleteError(getErrorMessage(err));
      }
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
    return <Progress />;
  }

  return (
    <>
      {secrets.length > 0 && (
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
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      )}

      {filteredSecrets.length === 0 ? (
        <Box className={classes.emptyState}>
          {searchQuery ? (
            <Typography variant="body1" color="textSecondary">
              No secrets match your search
            </Typography>
          ) : (
            <>
              <VpnKeyOutlinedIcon className={classes.emptyStateIcon} />
              <Typography variant="h6" color="textSecondary">
                No git secrets in {namespaceName}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Create a git secret to access private repositories during
                builds.
              </Typography>
            </>
          )}
        </Box>
      ) : (
        <TableContainer component={Paper} className={classes.tableContainer}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell style={{ width: '45%' }}>Name</TableCell>
                <TableCell style={{ width: '45%' }}>Workflow Plane</TableCell>
                <TableCell align="center" style={{ width: '10%' }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredSecrets.map(secret => (
                <TableRow key={secret.name}>
                  <TableCell>
                    <Box className={classes.nameCell}>
                      <VpnKeyOutlinedIcon className={classes.nameIcon} />
                      <Typography variant="body2" style={{ fontWeight: 500 }}>
                        {secret.name}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {secret.workflowPlaneName ? (
                      <Box display="flex" alignItems="center" gridGap={8}>
                        <Typography variant="body2">
                          {secret.workflowPlaneName}
                        </Typography>
                        {secret.workflowPlaneKind ===
                          'ClusterWorkflowPlane' && (
                          <Chip
                            label="Cluster"
                            size="small"
                            variant="outlined"
                            className={classes.scopeChip}
                          />
                        )}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="textSecondary">
                        -
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Delete secret">
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteClick(secret.name)}
                        className={classes.deleteButton}
                      >
                        <DeleteOutlineIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle disableTypography>
          <Typography variant="h4">Delete Git Secret</Typography>
        </DialogTitle>
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
          <Button
            onClick={handleDeleteCancel}
            disabled={deleting}
            variant="contained"
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            variant="outlined"
            disabled={deleting}
            className={classes.confirmDeleteButton}
            startIcon={deleting ? <CircularProgress size={20} /> : null}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
