import type { FC } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import FileCopyOutlinedIcon from '@material-ui/icons/FileCopyOutlined';
import { ProjectNotDeployedCallout } from './ProjectNotDeployedCallout';

const useStyles = makeStyles(theme => ({
  reasonChip: {
    backgroundColor: theme.palette.error.light,
    color: theme.palette.error.dark,
    fontWeight: 600,
    marginBottom: theme.spacing(1.5),
  },
  message: {
    // Full controller error — often a multi-line CEL dump. Give it a clear
    // container with breathing room; preserve newlines, wrap long tokens, and
    // keep it selectable + scrollable for very long text.
    margin: 0,
    padding: theme.spacing(1.5),
    backgroundColor: theme.palette.action.hover,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: '0.8125rem',
    lineHeight: 1.5,
    color: theme.palette.text.primary,
    maxHeight: '50vh',
    overflowY: 'auto',
  },
}));

export interface DeploymentErrorDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  /** Machine-readable reason, e.g. `RenderingFailed` / `AutoDeployFailed`. */
  reason?: string;
  /** The full controller failure message. */
  message?: string;
  /**
   * When true, the failure is attributed to the project not being deployed in
   * this environment — render the remediation callout below the raw error.
   */
  projectNotDeployed?: boolean;
  envName?: string;
  envResourceName?: string;
}

/**
 * Shows the full controller deployment error (reason + message) in a modal.
 * The deploy-tab banner ({@link DeploymentFailureBanner}) clamps the message to
 * keep the panel compact and opens this dialog on "View details" so the user
 * can read and copy the whole thing.
 */
export const DeploymentErrorDetailsDialog: FC<
  DeploymentErrorDetailsDialogProps
> = ({
  open,
  onClose,
  reason,
  message,
  projectNotDeployed,
  envName,
  envResourceName,
}) => {
  const classes = useStyles();
  const fullMessage =
    message || 'The controller could not roll out this release.';

  const handleCopy = async () => {
    const text = reason ? `${reason}\n\n${fullMessage}` : fullMessage;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API unavailable or permission denied — best-effort copy.
      // Mirrors ReleaseManifestDialog.handleCopy.
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="deployment-error-details-dialog-title"
    >
      <DialogTitle id="deployment-error-details-dialog-title">
        Deployment error
      </DialogTitle>

      <DialogContent dividers>
        {reason && (
          <Box>
            <Chip size="small" label={reason} className={classes.reasonChip} />
          </Box>
        )}
        <Box component="pre" className={classes.message}>
          {fullMessage}
        </Box>
        {projectNotDeployed && envName && (
          <Box mt={1.5}>
            <ProjectNotDeployedCallout
              variant="error-dialog"
              envName={envName}
              envResourceName={envResourceName}
            />
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button startIcon={<FileCopyOutlinedIcon />} onClick={handleCopy}>
          Copy
        </Button>
        <Button onClick={onClose} color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
