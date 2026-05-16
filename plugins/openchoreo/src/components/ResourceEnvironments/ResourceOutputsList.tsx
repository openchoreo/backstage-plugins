import { Box, Typography, makeStyles } from '@material-ui/core';
import type { ResourceBindingOutput } from '../../api/OpenChoreoClientApi';

const useStyles = makeStyles(theme => ({
  row: {
    display: 'grid',
    gridTemplateColumns: '160px 1fr',
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
}));

interface ResourceOutputsListProps {
  outputs: ResourceBindingOutput[];
}

/**
 * Renders ResourceReleaseBinding outputs with kind-aware formatting:
 * plain values inline, secret/configMap refs as Kind/name.key so consumers
 * can locate the underlying object without resolving the value here.
 */
export const ResourceOutputsList = ({ outputs }: ResourceOutputsListProps) => {
  const classes = useStyles();

  return (
    <Box>
      {outputs.map(output => (
        <Box key={output.name} className={classes.row}>
          <Typography variant="body2" className={classes.name}>
            {output.name}
          </Typography>
          <Typography variant="body2" className={classes.value}>
            {renderOutputValue(output, classes.kindLabel)}
          </Typography>
        </Box>
      ))}
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
