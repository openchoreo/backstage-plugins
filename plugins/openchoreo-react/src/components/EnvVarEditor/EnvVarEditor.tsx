import type { FC } from 'react';
import { TextField, IconButton, Grid, Box } from '@material-ui/core';
import { makeStyles, Theme } from '@material-ui/core/styles';
import DeleteIcon from '@material-ui/icons/Delete';
import type { EnvVar } from '@openchoreo/backstage-plugin-common';
import {
  DualModeInput,
  SecretSelector,
  type SecretOption,
} from '@openchoreo/backstage-design-system';

const useStyles = makeStyles((theme: Theme) => ({
  container: {
    padding: theme.spacing(1.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 6,
    marginBottom: theme.spacing(1),
    backgroundColor: theme.palette.background.default,
  },
  deleteButton: {
    marginLeft: theme.spacing(1),
  },
}));

export interface EnvVarEditorProps {
  /** The environment variable to edit */
  envVar: EnvVar;
  /** Available secrets for reference selection */
  secrets: SecretOption[];
  /** Whether the editor is disabled */
  disabled?: boolean;
  /** Current mode - 'plain' for text value, 'secret' for secret reference */
  mode: 'plain' | 'secret';
  /** Optional CSS class name */
  className?: string;
  /** Callback when any field changes */
  onChange: (field: keyof EnvVar, value: any) => void;
  /** Callback when the env var should be removed */
  onRemove: () => void;
  /** Callback when mode changes */
  onModeChange: (mode: 'plain' | 'secret') => void;
}

/**
 * Editor component for a single environment variable.
 * Supports both plain text values and secret references.
 *
 * @example
 * ```tsx
 * <EnvVarEditor
 *   envVar={{ key: 'API_KEY', value: 'secret123' }}
 *   secrets={[{ name: 'my-secret', keys: ['api-key'] }]}
 *   mode="plain"
 *   onChange={(field, value) => handleChange(field, value)}
 *   onRemove={() => handleRemove()}
 *   onModeChange={(mode) => setMode(mode)}
 * />
 * ```
 */
export const EnvVarEditor: FC<EnvVarEditorProps> = ({
  envVar,
  secrets,
  disabled = false,
  mode,
  className,
  onChange,
  onRemove,
  onModeChange,
}) => {
  const classes = useStyles();

  const handleModeChange = (newMode: 'plain' | 'secret') => {
    onModeChange(newMode);

    // Clear conflicting values when switching modes
    if (newMode === 'plain') {
      onChange('value', '');
      onChange('valueFrom', undefined);
    } else {
      onChange('value', undefined);
      onChange('valueFrom', { secretRef: { name: '', key: '' } });
    }
  };

  const handleSecretNameChange = (name: string) => {
    onChange('valueFrom', { secretRef: { name, key: '' } });
    // Clear value when setting valueFrom
    if (name && envVar.value) {
      onChange('value', undefined);
    }
  };

  const handleSecretKeyChange = (key: string) => {
    const currentName = envVar.valueFrom?.secretRef?.name || '';
    onChange('valueFrom', { secretRef: { name: currentName, key } });
    // Clear value when setting valueFrom
    if (key && envVar.value) {
      onChange('value', undefined);
    }
  };

  const handleValueChange = (value: string) => {
    onChange('value', value);
    // Clear valueFrom when setting value
    if (value && envVar.valueFrom) {
      onChange('valueFrom', undefined);
    }
  };

  const plainContent = (
    <Grid container spacing={1} alignItems="center">
      <Grid item xs={4}>
        <TextField
          label="Name"
          value={envVar.key || ''}
          onChange={e => onChange('key', e.target.value)}
          fullWidth
          variant="outlined"
          size="small"
          disabled={disabled}
        />
      </Grid>
      <Grid item xs={8}>
        <TextField
          label="Value"
          value={envVar.value || ''}
          onChange={e => handleValueChange(e.target.value)}
          fullWidth
          variant="outlined"
          size="small"
          disabled={disabled}
        />
      </Grid>
    </Grid>
  );

  const secretContent = (
    <Grid container spacing={1} alignItems="center">
      <Grid item xs={4}>
        <TextField
          label="Name"
          value={envVar.key || ''}
          onChange={e => onChange('key', e.target.value)}
          fullWidth
          variant="outlined"
          size="small"
          disabled={disabled}
        />
      </Grid>
      <Grid item xs={8}>
        <SecretSelector
          secretName={envVar.valueFrom?.secretRef?.name || ''}
          secretKey={envVar.valueFrom?.secretRef?.key || ''}
          secrets={secrets}
          onSecretNameChange={handleSecretNameChange}
          onSecretKeyChange={handleSecretKeyChange}
          disabled={disabled}
        />
      </Grid>
    </Grid>
  );

  return (
    <Box
      className={className || classes.container}
      display="flex"
      alignItems="center"
    >
      <Box flex={1}>
        <DualModeInput
          mode={mode}
          onModeChange={handleModeChange}
          plainContent={plainContent}
          secretContent={secretContent}
          disabled={disabled}
          tooltipPlain="Click to switch to secret reference"
          tooltipSecret="Click to switch to plain value"
        />
      </Box>
      <IconButton
        onClick={onRemove}
        color="secondary"
        size="small"
        disabled={disabled}
        className={classes.deleteButton}
        aria-label="Remove environment variable"
      >
        <DeleteIcon />
      </IconButton>
    </Box>
  );
};
