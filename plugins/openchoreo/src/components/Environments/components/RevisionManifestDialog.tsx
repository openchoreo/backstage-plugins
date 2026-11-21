import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@material-ui/core';
import FileCopyOutlinedIcon from '@material-ui/icons/FileCopyOutlined';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import { YamlViewer } from '@openchoreo/backstage-design-system';
import type { BindingRevision } from '@openchoreo/backstage-plugin-common';
import { revisionYaml } from './RevisionBrowserDialog';

export interface RevisionManifestDialogProps {
  open: boolean;
  onClose: () => void;
  /** The revision to show: the environment's active one. */
  revision?: BindingRevision;
  environmentName: string;
  /**
   * When provided, render an "Open Revision Browser" action that closes
   * this dialog and invokes the callback.
   */
  onOpenRevisionBrowser?: () => void;
}

/**
 * Modal dialog that renders the environment's active binding revision as
 * YAML, the revision counterpart of ReleaseManifestDialog: a quick look at
 * the current revision only, with the Revision Browser one click away for
 * the others. The revision is already loaded, so nothing is fetched.
 */
export const RevisionManifestDialog = ({
  open,
  onClose,
  revision,
  environmentName,
  onOpenRevisionBrowser,
}: RevisionManifestDialogProps) => {
  const yamlText = revision ? revisionYaml(revision) : null;

  const handleCopy = async () => {
    if (!yamlText) return;
    try {
      await navigator.clipboard.writeText(yamlText);
    } catch {
      // Clipboard API unavailable or permission denied — best-effort
      // copy. Mirrors ReleaseManifestDialog.handleCopy.
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="revision-manifest-dialog-title"
    >
      <DialogTitle id="revision-manifest-dialog-title">
        Revision manifest — {environmentName}
      </DialogTitle>
      <DialogContent dividers>
        {yamlText ? (
          <YamlViewer value={yamlText} maxHeight="60vh" showLineNumbers />
        ) : (
          <Typography variant="body2" color="textSecondary">
            No revision on this environment yet.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        {onOpenRevisionBrowser && (
          <Button
            startIcon={<OpenInNewIcon />}
            onClick={() => {
              // Close the manifest dialog before opening the browser so we
              // don't stack modals — users get one focused view at a time.
              onClose();
              onOpenRevisionBrowser();
            }}
          >
            Open Revision Browser
          </Button>
        )}
        <Button
          startIcon={<FileCopyOutlinedIcon />}
          onClick={handleCopy}
          disabled={!yamlText}
        >
          Copy
        </Button>
        <Button onClick={onClose} color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
