import { useCallback, useState, type ReactNode } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
  makeStyles,
} from '@material-ui/core';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
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
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(0.75),
  },
  outputName: {
    fontWeight: 600,
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
  linkValue: {
    color: theme.palette.primary.main,
    textDecoration: 'none',
    '&:hover': { textDecoration: 'underline' },
  },
  copyButton: {
    flexShrink: 0,
  },
  refPlaceholderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
    fontSize: '0.8rem',
  },
  refToggle: {
    textTransform: 'none',
    padding: theme.spacing(0, 0.5),
    minWidth: 0,
    color: theme.palette.text.secondary,
    fontSize: '0.75rem',
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
 *
 * Secret / ConfigMap refs are collapsed by default behind a "Show
 * reference" toggle. The Kind/name.key ref is internal plumbing that
 * developers never type by hand (they wire outputs through envBindings
 * on the consuming component); SRE/PE folks can expand for kubectl
 * debugging.
 *
 * Value-kind outputs that look like http(s) URLs render as links so
 * admin URLs and dashboards open in a new tab on click.
 */
export const ResourceOutputsDialog = ({
  open,
  onClose,
  environmentName,
  outputs,
}: ResourceOutputsDialogProps) => {
  const classes = useStyles();
  const notification = useNotification();
  const [expandedRefs, setExpandedRefs] = useState<Set<string>>(new Set());

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

  const toggleRef = (name: string) => {
    setExpandedRefs(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

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
            const refSourceLabel = refSourceLabelFor(output);
            const isRef = refSourceLabel !== null;
            const isExpanded = expandedRefs.has(output.name);
            const refText = refStringFor(output);
            return (
              <Box key={output.name} className={classes.outputBlock}>
                <Box className={classes.outputHeaderRow}>
                  <Typography
                    variant="subtitle2"
                    className={classes.outputName}
                  >
                    {output.name}
                  </Typography>
                  {isRef && (
                    <Button
                      size="small"
                      onClick={() => toggleRef(output.name)}
                      className={classes.refToggle}
                      startIcon={
                        isExpanded ? (
                          <ExpandLessIcon fontSize="small" />
                        ) : (
                          <ExpandMoreIcon fontSize="small" />
                        )
                      }
                    >
                      {isExpanded ? 'Hide reference' : 'Show reference'}
                    </Button>
                  )}
                </Box>

                {!isRef && (
                  <Box className={classes.valueRow}>
                    <Box className={classes.valueBox}>
                      {renderInlineValue(output, classes.linkValue)}
                    </Box>
                    <CopyIconButton
                      label={output.name}
                      text={output.value ?? ''}
                      onCopy={copy}
                      className={classes.copyButton}
                    />
                  </Box>
                )}

                {isRef && !isExpanded && (
                  <Box className={classes.refPlaceholderRow}>
                    Stored in {refSourceLabel}
                  </Box>
                )}

                {isRef && isExpanded && (
                  <Box className={classes.valueRow}>
                    <Box className={classes.valueBox}>{refText}</Box>
                    <CopyIconButton
                      label={output.name}
                      text={refText}
                      onCopy={copy}
                      className={classes.copyButton}
                    />
                  </Box>
                )}
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

interface CopyIconButtonProps {
  label: string;
  text: string;
  onCopy: (text: string, label: string) => Promise<void>;
  className?: string;
}

function CopyIconButton({
  label,
  text,
  onCopy,
  className,
}: CopyIconButtonProps) {
  return (
    <Tooltip title={`Copy ${label}`} PopperProps={{ disablePortal: true }}>
      <span>
        <IconButton
          size="small"
          className={className}
          onClick={() => onCopy(text, label)}
          disabled={!text}
          aria-label={`Copy ${label}`}
        >
          <FileCopyOutlinedIcon fontSize="small" />
        </IconButton>
      </span>
    </Tooltip>
  );
}

function refSourceLabelFor(output: ResourceBindingOutput): string | null {
  if (output.secretKeyRef) return 'Secret';
  if (output.configMapKeyRef) return 'ConfigMap';
  return null;
}

function refStringFor(output: ResourceBindingOutput): string {
  if (output.secretKeyRef) {
    return `Secret/${output.secretKeyRef.name}.${output.secretKeyRef.key}`;
  }
  if (output.configMapKeyRef) {
    return `ConfigMap/${output.configMapKeyRef.name}.${output.configMapKeyRef.key}`;
  }
  return '';
}

function renderInlineValue(
  output: ResourceBindingOutput,
  linkClass: string,
): ReactNode {
  const value = output.value;
  if (value === undefined) return '(unresolved)';
  if (isHttpUrl(value)) {
    return (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        {value}
      </a>
    );
  }
  return value;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}
