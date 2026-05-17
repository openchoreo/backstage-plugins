import { useCallback } from 'react';
import { Box, IconButton, Tooltip, Typography, makeStyles } from '@material-ui/core';
import FileCopyOutlinedIcon from '@material-ui/icons/FileCopyOutlined';
import type { ResourceBindingOutput } from '../../api/OpenChoreoClientApi';
import { useNotification } from '../../hooks';

const useStyles = makeStyles(theme => ({
  row: {
    display: 'grid',
    gridTemplateColumns: '140px 1fr auto',
    gap: theme.spacing(2),
    padding: theme.spacing(0.5, 0),
    alignItems: 'baseline',
  },
  name: {
    fontWeight: 500,
    color: theme.palette.text.primary,
  },
  value: {
    fontFamily: 'monospace',
    fontSize: '0.875rem',
    color: theme.palette.text.secondary,
    wordBreak: 'break-all',
  },
  kindLabel: {
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: theme.palette.text.hint,
    marginRight: theme.spacing(1),
  },
  copyButton: {
    padding: theme.spacing(0.25),
    alignSelf: 'center',
  },
}));

interface ResourceOutputsListProps {
  outputs: ResourceBindingOutput[];
}

/**
 * Renders ResourceReleaseBinding outputs with kind-aware formatting:
 * plain values inline, secret/configMap refs as Kind/name.key so consumers
 * can locate the underlying object without resolving the value here. Each
 * row has a copy-to-clipboard button for the rendered text.
 */
export const ResourceOutputsList = ({ outputs }: ResourceOutputsListProps) => {
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
    <Box>
      {outputs.map(output => {
        const copyText = copyTextForOutput(output);
        return (
          <Box key={output.name} className={classes.row}>
            <Typography variant="body2" className={classes.name}>
              {output.name}
            </Typography>
            <Typography variant="body2" className={classes.value}>
              {renderOutputValue(output, classes.kindLabel)}
            </Typography>
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
        );
      })}
    </Box>
  );
};

function renderOutputValue(
  output: ResourceBindingOutput,
  kindLabelClass: string,
) {
  if (output.value !== undefined) {
    return output.value;
  }
  if (output.secretKeyRef) {
    return (
      <>
        <span className={kindLabelClass}>secretRef</span>
        Secret/{output.secretKeyRef.name}.{output.secretKeyRef.key}
      </>
    );
  }
  if (output.configMapKeyRef) {
    return (
      <>
        <span className={kindLabelClass}>configMapRef</span>
        ConfigMap/{output.configMapKeyRef.name}.{output.configMapKeyRef.key}
      </>
    );
  }
  return <em>(unresolved)</em>;
}

function copyTextForOutput(output: ResourceBindingOutput): string {
  if (output.value !== undefined) return output.value;
  if (output.secretKeyRef) {
    return `Secret/${output.secretKeyRef.name}.${output.secretKeyRef.key}`;
  }
  if (output.configMapKeyRef) {
    return `ConfigMap/${output.configMapKeyRef.name}.${output.configMapKeyRef.key}`;
  }
  return '';
}
