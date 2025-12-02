import type { FC } from 'react';
import {
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@material-ui/core';
import { makeStyles, Theme } from '@material-ui/core/styles';

const useStyles = makeStyles((_theme: Theme) => ({
  formControl: {
    width: '100%',
  },
}));

export interface SecretOption {
  /** The name of the secret reference */
  name: string;
  /** Optional display name for the secret */
  displayName?: string;
  /** Available keys within this secret */
  keys: string[];
}

export interface SecretSelectorProps {
  /** Currently selected secret name */
  secretName: string;
  /** Currently selected secret key */
  secretKey: string;
  /** Available secrets to choose from */
  secrets: SecretOption[];
  /** Callback when secret name changes */
  onSecretNameChange: (name: string) => void;
  /** Callback when secret key changes */
  onSecretKeyChange: (key: string) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Label for the secret name dropdown (default: "Secret Reference Name") */
  nameLabel?: string;
  /** Label for the secret key dropdown (default: "Secret Reference Key") */
  keyLabel?: string;
  /** Variant for the form controls (default: "outlined") */
  variant?: 'outlined' | 'filled' | 'standard';
  /** Size for the form controls (default: "small") */
  size?: 'small' | 'medium';
}

/**
 * A dual-dropdown component for selecting a secret reference name and key.
 * Automatically clears the key when the name changes.
 */
export const SecretSelector: FC<SecretSelectorProps> = ({
  secretName,
  secretKey,
  secrets,
  onSecretNameChange,
  onSecretKeyChange,
  disabled = false,
  nameLabel = 'Secret Reference Name',
  keyLabel = 'Secret Reference Key',
  variant = 'outlined',
  size = 'small',
}) => {
  const classes = useStyles();

  const selectedSecret = secrets.find(s => s.name === secretName);
  const availableKeys = selectedSecret?.keys || [];

  const handleNameChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    const newName = event.target.value as string;
    onSecretNameChange(newName);
    // Auto-clear key when name changes
    if (newName !== secretName) {
      onSecretKeyChange('');
    }
  };

  const handleKeyChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    onSecretKeyChange(event.target.value as string);
  };

  return (
    <Grid container spacing={1}>
      <Grid item xs={6}>
        <FormControl
          className={classes.formControl}
          variant={variant}
          size={size}
        >
          <InputLabel>{nameLabel}</InputLabel>
          <Select
            value={secretName}
            onChange={handleNameChange}
            label={nameLabel}
            disabled={disabled}
          >
            <MenuItem value="">
              <em>
                {secrets.length === 0
                  ? 'No secret references available'
                  : 'Select a secret reference'}
              </em>
            </MenuItem>
            {secrets.map(secret => (
              <MenuItem key={secret.name} value={secret.name}>
                {secret.displayName || secret.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={6}>
        <FormControl
          className={classes.formControl}
          variant={variant}
          size={size}
        >
          <InputLabel>{keyLabel}</InputLabel>
          <Select
            value={secretKey}
            onChange={handleKeyChange}
            label={keyLabel}
            disabled={disabled || !secretName}
          >
            <MenuItem value="">
              <em>Select a key</em>
            </MenuItem>
            {availableKeys.map(key => (
              <MenuItem key={key} value={key}>
                {key}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
    </Grid>
  );
};
