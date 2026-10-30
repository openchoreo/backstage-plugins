import type { ReactNode } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';
import PlayCircleOutlineIcon from '@material-ui/icons/PlayCircleOutline';

const useStyles = makeStyles(theme => ({
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  deleteIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    flexShrink: 0,
    borderRadius: '50%',
    backgroundColor: theme.palette.error.main,
    color: theme.palette.error.contrastText,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingBottom: theme.spacing(3),
  },
  warning: {
    color: theme.palette.warning.main,
    overflowWrap: 'anywhere',
  },
  summary: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.background.default,
  },
  runIcon: {
    color: theme.palette.text.secondary,
    fontSize: 40,
    flexShrink: 0,
  },
  runDetails: {
    minWidth: 0,
    overflowWrap: 'anywhere',
  },
  metadata: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
    color: theme.palette.text.secondary,
  },
  actions: {
    padding: theme.spacing(2, 3),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  deleteButton: {
    color: theme.palette.error.main,
    borderColor: theme.palette.error.main,
  },
}));

export interface WorkflowRunDeleteDialogProps {
  open: boolean;
  runName?: string;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  /** Status and other available metadata identifying the selected run. */
  children?: ReactNode;
}

export const WorkflowRunDeleteDialog = ({
  open,
  runName,
  deleting,
  onCancel,
  onConfirm,
  children,
}: WorkflowRunDeleteDialogProps) => {
  const classes = useStyles();
  const handleClose = () => {
    if (!deleting) onCancel();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="delete-workflow-run-title"
      aria-describedby="delete-workflow-run-description delete-workflow-run-warning"
    >
      <DialogTitle id="delete-workflow-run-title" disableTypography>
        <Box className={classes.title}>
          <Box className={classes.deleteIcon}>
            <DeleteOutlineIcon />
          </Box>
          <Typography variant="h5">Delete Workflow Run</Typography>
        </Box>
      </DialogTitle>
      <DialogContent className={classes.content}>
        <Typography id="delete-workflow-run-description">
          Are you sure you want to delete the workflow run?
        </Typography>
        <Typography
          id="delete-workflow-run-warning"
          className={classes.warning}
        >
          This action cannot be undone. The workflow run{' '}
          <strong>{runName}</strong> and its associated resources in the
          workflow plane will be permanently deleted.
        </Typography>
        <Box className={classes.summary}>
          <PlayCircleOutlineIcon className={classes.runIcon} />
          <Box className={classes.runDetails}>
            <Typography variant="subtitle1">
              <strong>{runName}</strong>
            </Typography>
            <Box className={classes.metadata}>{children}</Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions className={classes.actions}>
        <Button onClick={handleClose} variant="outlined" disabled={deleting}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          variant="outlined"
          className={classes.deleteButton}
          disabled={deleting}
          startIcon={
            deleting ? (
              <CircularProgress size={16} color="inherit" />
            ) : undefined
          }
        >
          {deleting ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
