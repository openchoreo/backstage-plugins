import type { FC } from 'react';
import {
  TextField,
  IconButton,
  Grid,
  Box,
  Typography,
  Button,
} from '@material-ui/core';
import { makeStyles, Theme } from '@material-ui/core/styles';
import DeleteIcon from '@material-ui/icons/Delete';
import EditIcon from '@material-ui/icons/Edit';
import CheckIcon from '@material-ui/icons/Check';
import CloseIcon from '@material-ui/icons/Close';
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
  containerEditing: {
    padding: theme.spacing(1.5),
    border: `1px solid ${theme.palette.primary.main}`,
    borderRadius: 6,
    marginBottom: theme.spacing(1),
    backgroundColor: theme.palette.background.default,
    boxShadow: `0 0 0 1px ${theme.palette.primary.main}`,
  },
  actionButton: {
    marginLeft: theme.spacing(0.5),
  },
  readOnlyKey: {
    fontWeight: 600,
    fontSize: '0.875rem',
    color: theme.palette.text.primary,
  },
  readOnlyValue: {
    fontSize: '0.875rem',
    color: theme.palette.text.secondary,
    fontFamily: 'monospace',
    marginLeft: theme.spacing(1),
  },
  readOnlyContent: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0.5, 0),
  },
  secretIndicator: {
    fontSize: '0.75rem',
    color: theme.palette.info.main,
    marginLeft: theme.spacing(1),
  },
  baseValueInline: {
    marginTop: theme.spacing(1),
    paddingTop: theme.spacing(0.5),
    borderTop: `1px dashed ${theme.palette.grey[300]}`,
  },
  baseValueText: {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
    fontFamily: 'monospace',
  },
  inlineDiff: {
    display: 'inline-flex',
    alignItems: 'center',
    marginLeft: theme.spacing(0.5),
  },
  diffArrow: {
    color: theme.palette.text.disabled,
    margin: '0 6px',
    fontSize: '0.75rem',
  },
  baseValueStruck: {
    color: theme.palette.text.disabled,
    textDecoration: 'line-through',
    fontSize: '0.8rem',
    fontFamily: 'monospace',
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
  /** Whether this row is in edit mode */
  isEditing: boolean;
  /** Called when Edit/Override button clicked */
  onEdit: () => void;
  /** Called when Apply button clicked */
  onApply: () => void;
  /** Called when Cancel button clicked */
  onCancel?: () => void;
  /** Label for the edit button - "Edit" or "Override" */
  editButtonLabel?: string;
  /** If true, cannot toggle plain/secret mode */
  lockMode?: boolean;
  /** If true, cannot edit the key/name field */
  lockKey?: boolean;
  /** Separately disable the Edit button (when another row is editing) */
  editDisabled?: boolean;
  /** Separately disable the Delete button (when another row is editing) */
  deleteDisabled?: boolean;
  /** The base env var value (for overrides, to show inline diff) */
  baseValue?: EnvVar;
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
 * Has two visual states: read-only (displays values) and edit mode (input fields).
 */
export const EnvVarEditor: FC<EnvVarEditorProps> = ({
  envVar,
  secrets,
  disabled = false,
  mode,
  className,
  isEditing,
  onEdit,
  onApply,
  onCancel,
  editButtonLabel = 'Edit',
  lockMode = false,
  lockKey = false,
  editDisabled = false,
  deleteDisabled = false,
  baseValue,
  onChange,
  onRemove,
  onModeChange,
}) => {
  const classes = useStyles();

  const handleModeChange = (newMode: 'plain' | 'secret') => {
    if (lockMode) return;
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
    if (name && envVar.value) {
      onChange('value', undefined);
    }
  };

  const handleSecretKeyChange = (key: string) => {
    const currentName = envVar.valueFrom?.secretRef?.name || '';
    onChange('valueFrom', { secretRef: { name: currentName, key } });
    if (key && envVar.value) {
      onChange('value', undefined);
    }
  };

  const handleValueChange = (value: string) => {
    onChange('value', value);
    if (value && envVar.valueFrom) {
      onChange('valueFrom', undefined);
    }
  };

  // Format value for display (both current and base)
  const formatDisplayValue = (ev: EnvVar, m: 'plain' | 'secret') => {
    if (m === 'secret' && ev.valueFrom?.secretRef) {
      const { name, key } = ev.valueFrom.secretRef;
      return `Secret: ${name}/${key}`;
    }
    // Mask sensitive values
    const isSensitive =
      ev.key?.toLowerCase().includes('secret') ||
      ev.key?.toLowerCase().includes('password') ||
      ev.key?.toLowerCase().includes('token') ||
      ev.key?.toLowerCase().includes('key');
    if (isSensitive && ev.value && ev.value.length > 0) {
      return '••••••••';
    }
    return ev.value || '';
  };

  const getDisplayValue = () => formatDisplayValue(envVar, mode);

  // Determine base value mode
  const baseValueMode: 'plain' | 'secret' = baseValue?.valueFrom?.secretRef
    ? 'secret'
    : 'plain';

  // Read-only display
  if (!isEditing) {
    return (
      <Box className={className || classes.container}>
        <Box display="flex" alignItems="center">
          <Box flex={1} className={classes.readOnlyContent}>
            <Typography className={classes.readOnlyKey}>
              {envVar.key || '(no name)'}
            </Typography>
            <Typography className={classes.readOnlyValue}>
              = {getDisplayValue() || '(empty)'}
            </Typography>
            {mode === 'secret' && (
              <Typography className={classes.secretIndicator}>🔒</Typography>
            )}
            {/* Inline diff for overridden values */}
            {baseValue && (
              <Box className={classes.inlineDiff}>
                <Typography component="span" className={classes.diffArrow}>
                  ←
                </Typography>
                <Typography
                  component="span"
                  className={classes.baseValueStruck}
                >
                  {formatDisplayValue(baseValue, baseValueMode)}
                </Typography>
              </Box>
            )}
          </Box>
          <Button
            size="small"
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={onEdit}
            disabled={disabled || editDisabled}
            className={classes.actionButton}
          >
            {editButtonLabel}
          </Button>
          <IconButton
            onClick={onRemove}
            color="secondary"
            size="small"
            disabled={disabled || deleteDisabled}
            className={classes.actionButton}
            aria-label="Remove environment variable"
          >
            <DeleteIcon />
          </IconButton>
        </Box>
      </Box>
    );
  }

  // Edit mode
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
          disabled={disabled || lockKey}
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
          disabled={disabled || lockKey}
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
    <Box className={className || classes.containerEditing}>
      <Box display="flex" alignItems="center">
        <Box flex={1}>
          <DualModeInput
            mode={mode}
            onModeChange={handleModeChange}
            plainContent={plainContent}
            secretContent={secretContent}
            disabled={disabled || lockMode}
            tooltipPlain={
              lockMode
                ? 'Mode cannot be changed for overrides'
                : 'Click to switch to secret reference'
            }
            tooltipSecret={
              lockMode
                ? 'Mode cannot be changed for overrides'
                : 'Click to switch to plain value'
            }
          />
        </Box>
        <IconButton
          onClick={onApply}
          color="primary"
          size="small"
          disabled={disabled}
          className={classes.actionButton}
          aria-label="Apply changes"
        >
          <CheckIcon />
        </IconButton>
        {onCancel && (
          <IconButton
            onClick={onCancel}
            size="small"
            disabled={disabled}
            className={classes.actionButton}
            aria-label="Cancel editing"
          >
            <CloseIcon />
          </IconButton>
        )}
        <IconButton
          onClick={onRemove}
          color="secondary"
          size="small"
          disabled={disabled}
          className={classes.actionButton}
          aria-label="Remove environment variable"
        >
          <DeleteIcon />
        </IconButton>
      </Box>
      {/* Show base value hint in edit mode for overridden items */}
      {baseValue && (
        <Box className={classes.baseValueInline}>
          <Typography className={classes.baseValueText}>
            Base value: {formatDisplayValue(baseValue, baseValueMode)}
          </Typography>
        </Box>
      )}
    </Box>
  );
};
