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
  onModeChange: (containerName: string, envIndex: number, mode: 'plain' | 'secret') => void;
  getSecretKeys: (secretName: string) => string[];
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
  secretReferences,
  mode,
  onEnvVarChange,
  onRemoveEnvVar,
  onModeChange,
  getSecretKeys,
}) => {
  const isSecret = mode === 'secret';
  
  return (
    <Box className={className}>
      <Grid container spacing={1} alignItems="center">
        <Grid item style={{ display: 'flex', alignItems: 'center', paddingRight: '8px' }}>
          <Tooltip title={isSecret ? 'Switch to plain value' : 'Switch to secret reference'}>
            <IconButton
              onClick={() => onModeChange(containerName, index, isSecret ? 'plain' : 'secret')}
              size="small"
              disabled={disabled}
              color={isSecret ? 'primary' : 'default'}
              style={{ marginLeft: '4px' }}
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
                      secretRef: { name: secretName, key: '' } 
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
                    const currentSecret = envVar.valueFrom?.secretRef?.name || '';
                    onEnvVarChange(containerName, index, 'valueFrom', { 
                      secretRef: { name: currentSecret, key: secretKey } 
                    } as any);
                  }}
                  label="Secret Key"
                  disabled={disabled || !envVar.valueFrom?.secretRef?.name}
                >
                  <MenuItem value="">
                    <em>Select a key</em>
                  </MenuItem>
                  {getSecretKeys(envVar.valueFrom?.secretRef?.name || '').map(key => (
                    <MenuItem key={key} value={key}>
                      {key}
                    </MenuItem>
                  ))}
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
        
        <Grid item xs={2} style={{ display: 'flex', justifyContent: 'flex-end', paddingLeft: '16px' }}>
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
};
