import type { FC } from 'react';
import {
  TextField,
  IconButton,
  Grid,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
} from '@material-ui/core';
import DeleteIcon from '@material-ui/icons/Delete';
import LockIcon from '@material-ui/icons/Lock';
import LockOpenIcon from '@material-ui/icons/LockOpen';
import { EnvVar } from '@openchoreo/backstage-plugin-common';
import { SecretReference } from '../../../../api/secretReferences';
import { makeStyles } from '@material-ui/core/styles';

interface EnvVarRowProps {
  envVar: EnvVar;
  index: number;
  containerName: string;
  disabled: boolean;
  className: string;
  secretReferences: SecretReference[];
  mode: 'plain' | 'secret';
  onEnvVarChange: (
    containerName: string,
    envIndex: number,
    field: keyof EnvVar,
    value: string,
  ) => void;
  onRemoveEnvVar: (containerName: string, envIndex: number) => void;
  onModeChange: (
    containerName: string,
    envIndex: number,
    mode: 'plain' | 'secret',
  ) => void;
  onCleanupModes: (containerName: string, removedIndex: number) => void;
  getSecretKeys: (secretName: string) => string[];
}

const useStyles = makeStyles(theme => ({
  lockButton: {
    marginLeft: '4px',
    backgroundColor: 'transparent',
    border: '1px solid transparent',
    borderRadius: '8px',
    padding: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
      borderColor: '#000000',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      transform: 'translateY(-1px)',
    },
    '&:active': {
      transform: 'translateY(0)',
      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: '2px',
    },
  },
  lockButtonSecret: {
    backgroundColor: 'transparent',
    border: '1px solid transparent',
    color: theme.palette.primary.main,
    '&:hover': {
      borderColor: theme.palette.primary.main,
    },
  },
}));

/**
 * Renders a single environment variable row with edit/delete capabilities.
 */
export const EnvVarRow: FC<EnvVarRowProps> = ({
  envVar,
  index,
  containerName,
  disabled,
  className,
  secretReferences,
  mode,
  onEnvVarChange,
  onRemoveEnvVar,
  onModeChange,
  onCleanupModes,
  getSecretKeys,
}) => {
  const classes = useStyles();
  const isSecret = mode === 'secret';

  return (
    <Box className={className}>
      <Box display="flex" alignItems="center">
        <Grid container spacing={1} alignItems="center" style={{ flex: 1 }}>
          <Grid
            item
            style={{
              display: 'flex',
              alignItems: 'center',
              paddingRight: '8px',
            }}
          >
            <Tooltip
              title={
                isSecret
                  ? 'Click to switch to plain value'
                  : 'Click to switch to secret reference'
              }
            >
              <IconButton
                onClick={() =>
                  onModeChange(
                    containerName,
                    index,
                    isSecret ? 'plain' : 'secret',
                  )
                }
                size="small"
                disabled={disabled}
                className={`${classes.lockButton} ${
                  isSecret ? classes.lockButtonSecret : ''
                }`}
                color={isSecret ? 'primary' : 'default'}
              >
                {isSecret ? <LockIcon /> : <LockOpenIcon />}
              </IconButton>
            </Tooltip>
          </Grid>

          <Grid item xs={3}>
            <TextField
              label="Name"
              value={envVar.key || ''}
              onChange={e =>
                onEnvVarChange(containerName, index, 'key', e.target.value)
              }
              fullWidth
              variant="outlined"
              size="small"
              disabled={disabled}
            />
          </Grid>

          {isSecret ? (
            <>
              <Grid item xs={3}>
                <FormControl fullWidth variant="outlined" size="small">
                  <InputLabel>Secret Name</InputLabel>
                  <Select
                    value={envVar.valueFrom?.secretRef?.name || ''}
                    onChange={e => {
                      const secretName = e.target.value as string;
                      onEnvVarChange(containerName, index, 'valueFrom', {
                        secretRef: { name: secretName, key: '' },
                      } as any);
                    }}
                    label="Secret Name"
                    disabled={disabled}
                  >
                    <MenuItem value="">
                      <em>Select a secret</em>
                    </MenuItem>
                    {secretReferences.map(secret => (
                      <MenuItem key={secret.name} value={secret.name}>
                        {secret.displayName || secret.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={3}>
                <FormControl fullWidth variant="outlined" size="small">
                  <InputLabel>Secret Key</InputLabel>
                  <Select
                    value={envVar.valueFrom?.secretRef?.key || ''}
                    onChange={e => {
                      const secretKey = e.target.value as string;
                      const currentSecret =
                        envVar.valueFrom?.secretRef?.name || '';
                      onEnvVarChange(containerName, index, 'valueFrom', {
                        secretRef: { name: currentSecret, key: secretKey },
                      } as any);
                    }}
                    label="Secret Key"
                    disabled={disabled || !envVar.valueFrom?.secretRef?.name}
                  >
                    <MenuItem value="">
                      <em>Select a key</em>
                    </MenuItem>
                    {getSecretKeys(envVar.valueFrom?.secretRef?.name || '').map(
                      key => (
                        <MenuItem key={key} value={key}>
                          {key}
                        </MenuItem>
                      ),
                    )}
                  </Select>
                </FormControl>
              </Grid>
            </>
          ) : (
            <Grid item xs={6}>
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
        </Grid>
        <Box ml={2} display="flex" alignItems="center">
          <IconButton
            onClick={() => {
              onCleanupModes(containerName, index);
              onRemoveEnvVar(containerName, index);
            }}
            color="secondary"
            size="small"
            disabled={disabled}
          >
            <DeleteIcon />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
};
