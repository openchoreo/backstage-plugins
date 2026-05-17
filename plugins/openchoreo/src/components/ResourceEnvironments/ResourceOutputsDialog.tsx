import { useCallback } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
  makeStyles,
} from '@material-ui/core';
import FileCopyOutlinedIcon from '@material-ui/icons/FileCopyOutlined';
import type { ResourceBindingOutput } from '../../api/OpenChoreoClientApi';
import { useNotification } from '../../hooks';

export interface ResourceOutputsDialogProps {
  open: boolean;
  onClose: () => void;
  environmentName: string;
  outputs: ResourceBindingOutput[];
}

const useStyles = makeStyles(theme => ({
  outputBlock: {
    marginBottom: theme.spacing(2),
    '&:last-child': { marginBottom: 0 },
  },
  outputHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(0.75),
  },
  outputName: {
    fontWeight: 600,
  },
  kindChip: {
    height: 20,
    fontSize: '0.65rem',
    letterSpacing: 0.4,
  },
  valueRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(0.5),
  },
  valueBox: {
    flex: 1,
    backgroundColor:
      theme.palette.type === 'dark'
        ? 'rgba(255,255,255,0.05)'
        : 'rgba(0,0,0,0.04)',
    borderRadius: 4,
    padding: theme.spacing(0.75, 1),
    fontFamily: 'monospace',
    fontSize: '0.8rem',
    wordBreak: 'break-all',
    color: theme.palette.text.primary,
  },
  copyButton: {
    flexShrink: 0,
  },
  emptyText: {
    color: theme.palette.text.secondary,
  },
}));

/**
 * Modal that renders every output for a ResourceReleaseBinding in a
 * roomier layout than the side panel can fit. Each output gets its own
 * block with the kind chip, the value (or ref) in a wrappable monospace
 * box, and a copy button. The side panel only links here — the inline
 * list pattern was too cramped for long FQDNs and admin URLs.
 */
export const ResourceOutputsDialog = ({
  open,
  onClose,
  environmentName,
  outputs,
}: ResourceOutputsDialogProps) => {
  const classes = useStyles();
  const notification = useNotification();

  const copy = useCallback(
    async (text: string, label: string) => {
      try {
        await navigator.clipboard.writeText(text);
        notification.showSuccess(`Copied ${label}`);
      } catch {
        notification.showError('Failed to copy to clipboard');
      }
    },
    [notification],
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Outputs — {environmentName}</DialogTitle>
      <DialogContent dividers>
        {outputs.length === 0 ? (
          <Typography variant="body2" className={classes.emptyText}>
            No outputs published by this binding yet.
          </Typography>
        ) : (
          outputs.map(output => {
            const kind = kindOf(output);
            const display = renderValue(output);
            const copyText = copyTextFor(output);
            return (
              <Box key={output.name} className={classes.outputBlock}>
                <Box className={classes.outputHeaderRow}>
                  <Typography
                    variant="subtitle2"
                    className={classes.outputName}
                  >
                    {output.name}
                  </Typography>
                  <Chip label={kind} size="small" className={classes.kindChip} />
                </Box>
                <Box className={classes.valueRow}>
                  <Box className={classes.valueBox}>{display}</Box>
                  <Tooltip
                    title={`Copy ${output.name}`}
                    PopperProps={{ disablePortal: true }}
                  >
                    <span>
                      <IconButton
                        size="small"
                        className={classes.copyButton}
                        onClick={() => copy(copyText, output.name)}
                        disabled={!copyText}
                        aria-label={`Copy ${output.name}`}
                      >
                        <FileCopyOutlinedIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              </Box>
            );
          })
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

function kindOf(output: ResourceBindingOutput): string {
  if (output.value !== undefined) return 'VALUE';
  if (output.secretKeyRef) return 'SECRETREF';
  if (output.configMapKeyRef) return 'CONFIGMAPREF';
  return 'UNRESOLVED';
}

function renderValue(output: ResourceBindingOutput): string {
  if (output.value !== undefined) return output.value;
  if (output.secretKeyRef) {
    return `Secret/${output.secretKeyRef.name}.${output.secretKeyRef.key}`;
  }
  if (output.configMapKeyRef) {
    return `ConfigMap/${output.configMapKeyRef.name}.${output.configMapKeyRef.key}`;
  }
  return '(unresolved)';
}

function copyTextFor(output: ResourceBindingOutput): string {
  if (output.value !== undefined) return output.value;
  if (output.secretKeyRef) {
    return `Secret/${output.secretKeyRef.name}.${output.secretKeyRef.key}`;
  }
  if (output.configMapKeyRef) {
    return `ConfigMap/${output.configMapKeyRef.name}.${output.configMapKeyRef.key}`;
  }
  return '';
}
