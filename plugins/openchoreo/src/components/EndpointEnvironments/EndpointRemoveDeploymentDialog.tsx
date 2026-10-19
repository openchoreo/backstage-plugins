import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@material-ui/core';

export interface EndpointRemoveDeploymentDialogProps {
  open: boolean;
  environmentName: string;
  isRemoving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Confirms removing an Endpoint from an environment. Deleting the binding
 * removes the routes the endpoint renders there; the backend components keep
 * running and stay reachable through any routes of their own.
 */
export const EndpointRemoveDeploymentDialog = ({
  open,
  environmentName,
  isRemoving,
  onCancel,
  onConfirm,
}: EndpointRemoveDeploymentDialogProps) => (
  <Dialog
    open={open}
    onClose={() => {
      if (!isRemoving) onCancel();
    }}
    disableEscapeKeyDown={isRemoving}
    maxWidth="sm"
    fullWidth
    aria-labelledby="endpoint-remove-deployment-dialog-title"
  >
    <DialogTitle id="endpoint-remove-deployment-dialog-title">
      Remove deployment from {environmentName}?
    </DialogTitle>
    <DialogContent dividers>
      <Typography variant="body2" color="textSecondary" paragraph>
        This deletes the <strong>endpoint release binding</strong> for{' '}
        <strong>{environmentName}</strong>. As a result:
      </Typography>
      <ul style={{ marginTop: 0, paddingLeft: 20 }}>
        <li>
          <Typography variant="body2" color="textSecondary">
            The routes this endpoint renders in {environmentName} are removed,
            so traffic through them stops
          </Typography>
        </li>
        <li>
          <Typography variant="body2" color="textSecondary">
            Environment-specific overrides for this binding are lost
          </Typography>
        </li>
      </ul>
      <Typography variant="body2" color="textSecondary">
        The backend components are not affected.
      </Typography>
    </DialogContent>
    <DialogActions>
      <Button onClick={onCancel} disabled={isRemoving}>
        Cancel
      </Button>
      <Button
        onClick={onConfirm}
        color="secondary"
        variant="contained"
        disabled={isRemoving}
      >
        {isRemoving ? 'Removing...' : 'Remove deployment'}
      </Button>
    </DialogActions>
  </Dialog>
);
