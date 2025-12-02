import { useState, type FC } from 'react';
import {
  TextField,
  Button,
  IconButton,
  Grid,
  Typography,
  Box,
  Collapse,
  Paper,
  Tooltip,
  Snackbar,
} from '@material-ui/core';
import { makeStyles, Theme } from '@material-ui/core/styles';
import DeleteIcon from '@material-ui/icons/Delete';
import AttachFileIcon from '@material-ui/icons/AttachFile';
import VisibilityIcon from '@material-ui/icons/Visibility';
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff';
import LockIcon from '@material-ui/icons/Lock';
import LockOpenIcon from '@material-ui/icons/LockOpen';
import EditIcon from '@material-ui/icons/Edit';
import CheckIcon from '@material-ui/icons/Check';
import CloseIcon from '@material-ui/icons/Close';
import { Alert } from '@material-ui/lab';
import type { FileVar } from '@openchoreo/backstage-plugin-common';
import {
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
  // Read-only mode styles
  readOnlyHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0.5, 0),
  },
  modeIndicator: {
    marginRight: theme.spacing(1),
    color: theme.palette.text.secondary,
    display: 'flex',
    alignItems: 'center',
  },
  modeIndicatorSecret: {
    color: theme.palette.primary.main,
  },
  fileInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  fileNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  },
  fileName: {
    fontWeight: 600,
    fontSize: '0.875rem',
    color: theme.palette.text.primary,
  },
  mountPath: {
    fontSize: '0.875rem',
    color: theme.palette.text.secondary,
    fontFamily: 'monospace',
  },
  secretRef: {
    fontSize: '0.8rem',
    color: theme.palette.info.main,
    marginTop: theme.spacing(0.25),
  },
  contentPreview: {
    backgroundColor: theme.palette.grey[100],
    border: `1px solid ${theme.palette.grey[300]}`,
    borderRadius: 4,
    padding: theme.spacing(0.75),
    fontFamily: 'monospace',
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
    whiteSpace: 'pre',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginTop: theme.spacing(1),
    maxHeight: 60,
  },
  actionButton: {
    marginLeft: theme.spacing(0.5),
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
  // Edit mode styles
  editHeader: {
    backgroundColor: theme.palette.grey[50],
    borderBottom: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(1.5),
    margin: theme.spacing(-1.5, -1.5, 0, -1.5),
    borderRadius: '6px 6px 0 0',
  },
  editContent: {
    padding: theme.spacing(1.5, 0, 0, 0),
  },
  editContentPreview: {
    backgroundColor: theme.palette.grey[100],
    border: `1px solid ${theme.palette.grey[300]}`,
    borderRadius: 4,
    padding: theme.spacing(1),
    fontFamily: 'monospace',
    fontSize: '0.875rem',
    color: theme.palette.text.secondary,
    whiteSpace: 'pre',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  uploadActions: {
    display: 'flex',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
  lockButton: {
    marginRight: theme.spacing(1),
    backgroundColor: 'transparent',
    border: '1px solid transparent',
    borderRadius: 8,
    padding: 8,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
      borderColor: theme.palette.text.primary,
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      transform: 'translateY(-1px)',
    },
    '&:active': {
      transform: 'translateY(0)',
      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 2,
    },
  },
  lockButtonSecret: {
    color: theme.palette.primary.main,
    '&:hover': {
      borderColor: theme.palette.primary.main,
    },
  },
}));

export interface FileVarEditorProps {
  /** The file variable to edit */
  fileVar: FileVar;
  /** Unique identifier for this editor (used for file input IDs) */
  id: string;
  /** Available secrets for reference selection */
  secrets: SecretOption[];
  /** Whether the editor is disabled */
  disabled?: boolean;
  /** Current mode - 'plain' for file content, 'secret' for secret reference */
  mode: 'plain' | 'secret';
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
  /** If true, cannot edit the filename (key) field - used for overrides */
  lockKey?: boolean;
  /** Separately disable the Edit button (when another row is editing) */
  editDisabled?: boolean;
  /** Separately disable the Delete button (when another row is editing) */
  deleteDisabled?: boolean;
  /** The base file var value (for overrides, to show original value) */
  baseValue?: FileVar;
  /** Whether base value section is expanded */
  showBaseValue?: boolean;
  /** Toggle base value visibility */
  onToggleBaseValue?: () => void;
  /** Callback when any field changes */
  onChange: (field: keyof FileVar, value: any) => void;
  /** Callback when the file var should be removed */
  onRemove: () => void;
  /** Callback when mode changes */
  onModeChange: (mode: 'plain' | 'secret') => void;
}

/**
 * Editor component for a single file mount.
 * Supports both direct file content and secret references.
 * Has two visual states: read-only (compact display) and edit mode (full form).
 */
export const FileVarEditor: FC<FileVarEditorProps> = ({
  fileVar,
  id,
  secrets,
  disabled = false,
  mode,
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
  showBaseValue = false,
  onToggleBaseValue,
  onChange,
  onRemove,
  onModeChange,
}) => {
  const classes = useStyles();
  const [isContentExpanded, setIsContentExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSecret = mode === 'secret';
  const hasContent = fileVar.value && fileVar.value.length > 0;

  const getModeToggleTooltip = () => {
    if (lockMode) return 'Mode cannot be changed for overrides';
    if (isSecret) return 'Click to switch to file content';
    return 'Click to switch to secret reference';
  };

  const getContentPreview = (content: string, maxLines: number = 2): string => {
    const lines = content.split('\n');
    if (lines.length <= maxLines) return content;
    return `${lines.slice(0, maxLines).join('\n')}...`;
  };

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
    if (name && fileVar.value) {
      onChange('value', undefined);
    }
  };

  const handleSecretKeyChange = (key: string) => {
    const currentName = fileVar.valueFrom?.secretRef?.name || '';
    onChange('valueFrom', { secretRef: { name: currentName, key } });
    if (key && fileVar.value) {
      onChange('value', undefined);
    }
  };

  const handleValueChange = (value: string) => {
    onChange('value', value);
    if (value && fileVar.valueFrom) {
      onChange('valueFrom', undefined);
    }
    // Auto-expand when user starts typing (transitioning from empty to non-empty)
    if (value && !isContentExpanded) {
      setIsContentExpanded(true);
    }
  };

  const handleFileUpload = (file: File, inputElement: HTMLInputElement) => {
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const content = event.target?.result as string;
        onChange('value', content);
        if (content && fileVar.valueFrom) {
          onChange('valueFrom', undefined);
        }
        if (!fileVar.key) {
          onChange('key', file.name);
        }
        inputElement.value = '';
      } catch (err) {
        setError('Error reading file. Please try again.');
        inputElement.value = '';
      }
    };
    reader.onerror = () => {
      setError('Failed to read file. Please check the file and try again.');
      inputElement.value = '';
    };
    reader.readAsText(file);
  };

  // Format base value for display
  const formatBaseValue = (fv: FileVar): string => {
    if (fv.valueFrom?.secretRef) {
      const { name, key } = fv.valueFrom.secretRef;
      return `Secret: ${name}/${key}`;
    }
    if (fv.value && fv.value.length > 0) {
      return getContentPreview(fv.value, 1);
    }
    return '(empty)';
  };

  // Read-only display
  if (!isEditing) {
    return (
      <>
        <Paper className={classes.container} elevation={0}>
          <Box className={classes.readOnlyHeader}>
            <Box
              className={`${classes.modeIndicator} ${
                isSecret ? classes.modeIndicatorSecret : ''
              }`}
            >
              {isSecret ? (
                <LockIcon fontSize="small" />
              ) : (
                <LockOpenIcon fontSize="small" />
              )}
            </Box>
            <Box className={classes.fileInfo}>
              <Box className={classes.fileNameRow}>
                <Typography className={classes.fileName}>
                  {fileVar.key || '(no name)'}
                </Typography>
                <Typography className={classes.mountPath}>
                  → {fileVar.mountPath || '(no path)'}
                </Typography>
              </Box>
              {isSecret && fileVar.valueFrom?.secretRef && (
                <Typography className={classes.secretRef}>
                  Secret: {fileVar.valueFrom.secretRef.name}/
                  {fileVar.valueFrom.secretRef.key}
                </Typography>
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
            {baseValue && onToggleBaseValue && (
              <IconButton
                onClick={onToggleBaseValue}
                size="small"
                disabled={disabled}
                className={classes.actionButton}
                title={showBaseValue ? 'Hide base value' : 'View base value'}
              >
                {showBaseValue ? (
                  <VisibilityOffIcon fontSize="small" />
                ) : (
                  <VisibilityIcon fontSize="small" />
                )}
              </IconButton>
            )}
            <IconButton
              onClick={onRemove}
              color="secondary"
              size="small"
              disabled={disabled || deleteDisabled}
              className={classes.actionButton}
              aria-label="Remove file mount"
            >
              <DeleteIcon />
            </IconButton>
          </Box>
          {/* Content preview for plain mode */}
          {!isSecret && hasContent && (
            <Box className={classes.contentPreview}>
              {getContentPreview(fileVar.value!)}
            </Box>
          )}
          {/* Inline base value display */}
          {showBaseValue && baseValue && (
            <Box className={classes.baseValueInline}>
              <Typography className={classes.baseValueText}>
                Base: {baseValue.key} → {baseValue.mountPath}:{' '}
                {formatBaseValue(baseValue)}
              </Typography>
            </Box>
          )}
        </Paper>

        <Snackbar
          open={!!error}
          autoHideDuration={6000}
          onClose={() => setError(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={() => setError(null)} severity="error">
            {error}
          </Alert>
        </Snackbar>
      </>
    );
  }

  // Edit mode
  return (
    <>
      <Paper className={classes.containerEditing} elevation={0}>
        <Box className={classes.editHeader}>
          <Grid container spacing={1} alignItems="center">
            <Grid
              item
              style={{
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Tooltip title={getModeToggleTooltip()}>
                <span>
                  <IconButton
                    onClick={() =>
                      handleModeChange(isSecret ? 'plain' : 'secret')
                    }
                    size="small"
                    disabled={disabled || lockMode}
                    className={`${classes.lockButton} ${
                      isSecret ? classes.lockButtonSecret : ''
                    }`}
                    color={isSecret ? 'primary' : 'default'}
                    aria-label={
                      isSecret
                        ? 'Switch to file content'
                        : 'Switch to secret reference'
                    }
                  >
                    {isSecret ? <LockIcon /> : <LockOpenIcon />}
                  </IconButton>
                </span>
              </Tooltip>
            </Grid>

            <Grid item xs>
              <Grid container spacing={1}>
                <Grid item xs={5}>
                  <TextField
                    label="File Name"
                    value={fileVar.key || ''}
                    onChange={e => onChange('key', e.target.value)}
                    fullWidth
                    variant="outlined"
                    size="small"
                    disabled={disabled || lockKey}
                  />
                </Grid>
                <Grid item xs={5}>
                  <TextField
                    label="Mount Path"
                    value={fileVar.mountPath || ''}
                    onChange={e => onChange('mountPath', e.target.value)}
                    fullWidth
                    variant="outlined"
                    size="small"
                    disabled={disabled}
                  />
                </Grid>
              </Grid>
            </Grid>

            <Grid item style={{ display: 'flex', alignItems: 'center' }}>
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
                aria-label="Remove file mount"
              >
                <DeleteIcon />
              </IconButton>
            </Grid>
          </Grid>
        </Box>

        <Box className={classes.editContent}>
          {isSecret ? (
            <SecretSelector
              secretName={fileVar.valueFrom?.secretRef?.name || ''}
              secretKey={fileVar.valueFrom?.secretRef?.key || ''}
              secrets={secrets}
              onSecretNameChange={handleSecretNameChange}
              onSecretKeyChange={handleSecretKeyChange}
              disabled={disabled}
            />
          ) : (
            <>
              {hasContent && (
                <Box mb={1}>
                  <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    mb={1}
                  >
                    <Typography variant="caption" color="textSecondary">
                      Content Preview
                    </Typography>
                    <Button
                      size="small"
                      startIcon={
                        isContentExpanded ? (
                          <VisibilityOffIcon />
                        ) : (
                          <VisibilityIcon />
                        )
                      }
                      onClick={() => setIsContentExpanded(!isContentExpanded)}
                      disabled={disabled}
                    >
                      {isContentExpanded
                        ? 'Collapse Content'
                        : 'Expand Content'}
                    </Button>
                  </Box>

                  {!isContentExpanded && (
                    <Box className={classes.editContentPreview}>
                      {getContentPreview(fileVar.value!)}
                    </Box>
                  )}
                </Box>
              )}

              <Collapse in={isContentExpanded || !hasContent}>
                <TextField
                  disabled={disabled}
                  label={hasContent ? 'Edit Content' : 'Content'}
                  value={fileVar.value || ''}
                  onChange={e => handleValueChange(e.target.value)}
                  fullWidth
                  variant="outlined"
                  size="small"
                  multiline
                  minRows={hasContent ? 6 : 3}
                  placeholder="Enter file content or upload a file"
                  InputProps={{
                    style: {
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                    },
                  }}
                />
              </Collapse>

              <Box className={classes.uploadActions}>
                <input
                  accept="*/*"
                  style={{ display: 'none' }}
                  id={`file-upload-${id}`}
                  type="file"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileUpload(file, e.target);
                    }
                  }}
                  disabled={disabled}
                />
                <label htmlFor={`file-upload-${id}`}>
                  <Button
                    variant="outlined"
                    component="span"
                    size="small"
                    startIcon={<AttachFileIcon />}
                    disabled={disabled}
                  >
                    Upload File
                  </Button>
                </label>
              </Box>
            </>
          )}
        </Box>

        {/* Inline base value display (also shown in edit mode) */}
        {showBaseValue && baseValue && (
          <Box className={classes.baseValueInline}>
            <Typography className={classes.baseValueText}>
              Base: {baseValue.key} → {baseValue.mountPath}:{' '}
              {formatBaseValue(baseValue)}
            </Typography>
          </Box>
        )}
      </Paper>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setError(null)} severity="error">
          {error}
        </Alert>
      </Snackbar>
    </>
  );
};
