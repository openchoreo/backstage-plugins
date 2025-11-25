import type { FC } from 'react';
import {
  TextField,
  IconButton,
  Grid,
  Typography,
  Box,
} from '@material-ui/core';
import DeleteIcon from '@material-ui/icons/Delete';
import { EnvVar } from '@openchoreo/backstage-plugin-common';

interface EnvVarRowProps {
  envVar: EnvVar;
  index: number;
  containerName: string;
  disabled: boolean;
  className: string;
  onEnvVarChange: (
    containerName: string,
    envIndex: number,
    field: keyof EnvVar,
    value: string,
  ) => void;
  onRemoveEnvVar: (containerName: string, envIndex: number) => void;
}

/**
 * Renders a single environment variable row with edit/delete capabilities.
 */
export const EnvVarRow: FC<EnvVarRowProps> = ({
  envVar,
  index,
  containerName,
  disabled,
  className,
  onEnvVarChange,
  onRemoveEnvVar,
}) => (
  <Box className={className}>
    <Grid container spacing={2} alignItems="center">
      <Grid item xs={5}>
        <TextField
          label="Name"
          value={envVar.key || ''}
          onChange={e =>
            onEnvVarChange(containerName, index, 'key', e.target.value)
          }
          fullWidth
          variant="outlined"
          size="small"
          disabled={!!envVar.valueFrom || disabled}
        />
      </Grid>
      {envVar.valueFrom?.secretRef ? (
        <Grid item xs={5}>
          <Typography variant="body2">
            Secret: {envVar.valueFrom.secretRef.name}:
            {envVar.valueFrom.secretRef.key}
          </Typography>
        </Grid>
      ) : (
        <Grid item xs={5}>
          <TextField
            disabled={disabled}
            label="Value"
            value={envVar.value || ''}
            onChange={e =>
              onEnvVarChange(containerName, index, 'value', e.target.value)
            }
            fullWidth
            variant="outlined"
            size="small"
          />
        </Grid>
      )}
      <Grid item xs={2}>
        <IconButton
          onClick={() => onRemoveEnvVar(containerName, index)}
          color="secondary"
          size="small"
          disabled={disabled}
        >
          <DeleteIcon />
        </IconButton>
      </Grid>
    </Grid>
  </Box>
);
