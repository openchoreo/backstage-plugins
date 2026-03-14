import { useState } from 'react';
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
} from '@material-ui/core';
import { Table, TableColumn } from '@backstage/core-components';
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';
import AddIcon from '@material-ui/icons/Add';
import VpnKeyOutlinedIcon from '@material-ui/icons/VpnKeyOutlined';
import { makeStyles } from '@material-ui/core/styles';
import { GitSecret } from '../../api/OpenChoreoClientApi';
import { isForbiddenError, getErrorMessage } from '../../utils/errorUtils';

const useStyles = makeStyles(theme => ({
  tableWrapper: {
    '& [class*="MuiPaper-root"][class*="MuiPaper-elevation"]': {
      borderRadius: '12px !important',
      border: `1px solid ${
        theme.palette.type === 'dark'
          ? 'rgba(255, 255, 255, 0.12)'
          : 'rgb(243, 244, 246)'
      } !important`,
      boxShadow:
        'rgba(0, 0, 0, 0.05) 0px 1px 3px 0px, rgba(0, 0, 0, 0.03) 0px 1px 2px 0px !important',
    },
    '& [class*="MuiTableFooter-root"]': {
      borderRadius: '0 0 12px 12px !important',
    },
    '& tfoot td': {
      borderBottom: 'none !important',
    },
    '& [class*="MuiTablePagination-toolbar"]': {
      borderBottomLeftRadius: '12px !important',
      borderBottomRightRadius: '12px !important',
    },
    '& tbody tr': {
      transition: 'background-color 0.2s ease',
      '&:hover': {
        backgroundColor: theme.palette.action.hover,
      },
    },
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
  emptyStateContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(6, 2),
    gap: theme.spacing(1),
  },
  emptyStateIcon: {
    fontSize: 48,
    color: theme.palette.text.disabled,
    marginBottom: theme.spacing(1),
  },
  createButton: {
    textTransform: 'none',
    marginRight: theme.spacing(2),
    borderRadius: theme.spacing(1),
  },
}));

interface SecretsTableProps {
  secrets: GitSecret[];
  loading: boolean;
  onDelete: (secretName: string) => Promise<void>;
  onCreateClick: () => void;
  namespaceName: string;
}

export const SecretsTable = ({
  secrets,
  loading,
  onDelete,
  onCreateClick,
  namespaceName,
}: SecretsTableProps) => {
  const classes = useStyles();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [secretToDelete, setSecretToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteClick = (event: React.MouseEvent, secretName: string) => {
    event.stopPropagation();
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

  const columns: TableColumn<GitSecret>[] = [
    {
      title: 'Name',
      field: 'name',
      highlight: true,
      render: (row: GitSecret) => (
        <Box className={classes.nameCell}>
          <VpnKeyOutlinedIcon className={classes.nameIcon} />
          <Typography variant="body2" style={{ fontWeight: 500 }}>
            {row.name}
          </Typography>
        </Box>
      ),
    },
    {
      title: 'Workflow Plane',
      field: 'workflowPlaneName',
      render: (row: GitSecret) => {
        if (!row.workflowPlaneName) {
          return (
            <Typography variant="body2" color="textSecondary">
              -
            </Typography>
          );
        }
        const isCluster = row.workflowPlaneKind === 'ClusterWorkflowPlane';
        return (
          <Box display="flex" alignItems="center" gridGap={8}>
            <Typography variant="body2">{row.workflowPlaneName}</Typography>
            {isCluster && (
              <Chip
                label="Cluster"
                size="small"
                variant="outlined"
                className={classes.scopeChip}
              />
            )}
          </Box>
        );
      },
    },
    {
      title: '',
      field: 'actions',
      sorting: false,
      searchable: false,
      width: '60px',
      render: (row: GitSecret) => (
        <Tooltip title="Delete secret">
          <IconButton
            size="small"
            className={classes.deleteButton}
            onClick={e => handleDeleteClick(e, row.name)}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <>
      <Box className={classes.tableWrapper}>
        <Table
          title=""
          columns={columns}
          data={secrets}
          isLoading={loading}
          emptyContent={
            <Box className={classes.emptyStateContainer}>
              <VpnKeyOutlinedIcon className={classes.emptyStateIcon} />
              <Typography variant="h6" color="textSecondary">
                No git secrets in {namespaceName}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Create a git secret to access private repositories during
                builds.
              </Typography>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<AddIcon />}
                onClick={onCreateClick}
                style={{ marginTop: 8 }}
              >
                Create Secret
              </Button>
            </Box>
          }
          options={{
            paging: secrets.length > 10,
            pageSize: 10,
            pageSizeOptions: [10, 20, 50],
            search: secrets.length > 0,
            padding: 'default',
            draggable: false,
            actionsColumnIndex: -1,
          }}
          actions={[
            {
              icon: () => <AddIcon />,
              tooltip: 'Create Secret',
              isFreeAction: true,
              onClick: () => onCreateClick(),
            },
          ]}
          components={{
            Action: ({ action }: any) => (
              <Button
                variant="contained"
                color="primary"
                size="small"
                startIcon={<AddIcon />}
                className={classes.createButton}
                onClick={(event: React.MouseEvent) =>
                  action.onClick(event, undefined)
                }
              >
                Create Secret
              </Button>
            ),
          }}
        />
      </Box>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        PaperProps={{ style: { borderRadius: 12 } }}
      >
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
