import { useState } from 'react';
import {
  TextField,
  Button,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  Grid,
  Typography,
  Box,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import DeleteIcon from '@material-ui/icons/Delete';
import AddIcon from '@material-ui/icons/Add';
import EditIcon from '@material-ui/icons/Edit';
import {
  Container,
  EnvVar,
  FileVar,
  ModelsBuild,
  ModelsWorkload,
} from '@openchoreo/backstage-plugin-common';
import {
  ImageSelector,
  EnvVarEditor,
  FileVarEditor,
  useModeState,
  type SecretReference,
} from '@openchoreo/backstage-plugin-react';
import type { SecretOption } from '@openchoreo/backstage-design-system';
import { EnvVarStatusBadge } from './EnvVarStatusBadge';
import {
  mergeEnvVarsWithStatus,
  getBaseEnvVarsForContainer,
  formatEnvVarValue,
} from '../../utils/envVarUtils';

export interface ContainerContentProps {
  /** Map of container name to container configuration */
  containers: { [key: string]: Container };
  /** Callback when a container field changes */
  onContainerChange: (
    containerName: string,
    field: keyof Container,
    value: string | string[],
  ) => void;
  /** Callback when an environment variable field changes */
  onEnvVarChange: (
    containerName: string,
    envIndex: number,
    field: keyof EnvVar,
    value: string,
  ) => void;
  /** Callback when a file mount field changes */
  onFileVarChange: (
    containerName: string,
    fileIndex: number,
    field: keyof FileVar,
    value: string,
  ) => void;
  /** Callback when a new container should be added */
  onAddContainer: () => void;
  /** Callback when a container should be removed */
  onRemoveContainer: (containerName: string) => void;
  /** Callback when a new environment variable should be added */
  onAddEnvVar: (containerName: string) => void;
  /** Callback when an environment variable should be removed */
  onRemoveEnvVar: (containerName: string, envIndex: number) => void;
  /** Callback when a new file mount should be added */
  onAddFileVar: (containerName: string) => void;
  /** Callback when a file mount should be removed */
  onRemoveFileVar: (containerName: string, fileIndex: number) => void;
  /** Callback when an array field (command, args) changes */
  onArrayFieldChange: (
    containerName: string,
    field: 'command' | 'args',
    value: string,
  ) => void;
  /** Whether the editor is disabled */
  disabled: boolean;
  /** Whether only a single container is allowed */
  singleContainerMode: boolean;
  /** Whether to hide container fields (image, command, args) */
  hideContainerFields?: boolean;
  /** Available builds for image selection (optional) */
  builds?: ModelsBuild[];
  /** Available secret references (optional) */
  secretReferences?: SecretReference[];
  /** Base workload data for reference display (optional) */
  baseWorkloadData?: ModelsWorkload | null;
  /** Whether to show env var status badges and enable inline override (optional) */
  showEnvVarStatus?: boolean;
  /** Callback when user starts overriding an inherited env var (optional) */
  onStartOverride?: (containerName: string, envVar: EnvVar) => void;
}

/** Tracks which env var row is currently being edited */
interface EditingRowState {
  containerName: string;
  index: number;
  isNew?: boolean;
  originalEnvVar?: EnvVar; // Store original values for revert on cancel
}

const useStyles = makeStyles(theme => ({
  containerCard: {
    padding: theme.spacing(0),
    marginBottom: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    backgroundColor: theme.palette.background.paper,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  addButton: {
    marginTop: theme.spacing(1),
  },
  envVarRowWrapper: {
    marginBottom: theme.spacing(1),
  },
  inheritedRow: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(1, 1.5),
    backgroundColor: theme.palette.grey[50],
    borderRadius: 4,
    border: `1px dashed ${theme.palette.grey[300]}`,
  },
  inheritedContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    marginLeft: theme.spacing(1),
  },
  inheritedKey: {
    fontWeight: 600,
    fontSize: '0.875rem',
    color: theme.palette.text.primary,
  },
  inheritedValue: {
    fontSize: '0.8rem',
    color: theme.palette.text.secondary,
    fontFamily: 'monospace',
  },
  overrideButton: {
    marginLeft: 'auto',
  },
  statusBadgeWrapper: {
    marginBottom: theme.spacing(0.5),
  },
}));

/**
 * Component for editing container configurations including image, command, args,
 * environment variables, and file mounts.
 */
export function ContainerContent({
  containers,
  onContainerChange,
  onEnvVarChange,
  onAddContainer,
  onRemoveContainer,
  onAddEnvVar,
  onRemoveEnvVar,
  onArrayFieldChange,
  onFileVarChange,
  onAddFileVar,
  onRemoveFileVar,
  disabled,
  singleContainerMode,
  hideContainerFields = false,
  builds = [],
  secretReferences = [],
  baseWorkloadData,
  showEnvVarStatus = false,
  onStartOverride,
}: ContainerContentProps) {
  const classes = useStyles();

  // Track which row is currently being edited (only one at a time)
  const [editingRow, setEditingRow] = useState<EditingRowState | null>(null);

  // Track which overridden rows have base value expanded
  const [expandedBaseRows, setExpandedBaseRows] = useState<Set<string>>(
    new Set(),
  );

  // Use mode state hooks for tracking plain/secret modes
  const envModes = useModeState({ type: 'env', initialContainers: containers });
  const fileModes = useModeState({
    type: 'file',
    initialContainers: containers,
  });

  const containerEntries = Object.entries(containers);
  const showAddButton = !singleContainerMode || containerEntries.length === 0;

  // Whether any row is currently being edited
  const isAnyRowEditing = editingRow !== null;

  // Convert secret references to SecretOption format
  const secretOptions: SecretOption[] = secretReferences.map(ref => ({
    name: ref.name,
    displayName: ref.displayName,
    keys: ref.data?.map(item => item.secretKey) || [],
  }));

  const handleRemoveContainer = (containerName: string) => {
    envModes.cleanupContainer(containerName);
    fileModes.cleanupContainer(containerName);
    onRemoveContainer(containerName);
  };

  const handleEnvVarModeChange = (
    containerName: string,
    index: number,
    mode: 'plain' | 'secret',
  ) => {
    envModes.setMode(containerName, index, mode);

    // Clear conflicting values when switching modes
    if (mode === 'plain') {
      onEnvVarChange(containerName, index, 'value', '');
      onEnvVarChange(containerName, index, 'valueFrom', undefined as any);
    } else {
      onEnvVarChange(containerName, index, 'value', undefined as any);
      onEnvVarChange(containerName, index, 'valueFrom', {
        secretRef: { name: '', key: '' },
      } as any);
    }
  };

  const handleFileVarModeChange = (
    containerName: string,
    index: number,
    mode: 'plain' | 'secret',
  ) => {
    fileModes.setMode(containerName, index, mode);

    // Clear conflicting values when switching modes
    if (mode === 'plain') {
      onFileVarChange(containerName, index, 'value', '');
      onFileVarChange(containerName, index, 'valueFrom', undefined as any);
    } else {
      onFileVarChange(containerName, index, 'value', undefined as any);
      onFileVarChange(containerName, index, 'valueFrom', {
        secretRef: { name: '', key: '' },
      } as any);
    }
  };

  const handleRemoveEnvVar = (containerName: string, index: number) => {
    envModes.cleanupIndex(containerName, index);
    onRemoveEnvVar(containerName, index);
    // Clear editing state if this row was being edited
    if (
      editingRow?.containerName === containerName &&
      editingRow?.index === index
    ) {
      setEditingRow(null);
    }
  };

  const handleRemoveFileVar = (containerName: string, index: number) => {
    fileModes.cleanupIndex(containerName, index);
    onRemoveFileVar(containerName, index);
  };

  // Check if an env var is empty (no key, no value, no secret ref)
  const isEnvVarEmpty = (envVar: EnvVar | undefined) => {
    if (!envVar) return true;
    return !envVar.key && !envVar.value && !envVar.valueFrom?.secretRef?.name;
  };

  // Handle adding a new env var - starts in edit mode
  const handleAddEnvVar = (containerName: string) => {
    onAddEnvVar(containerName);
    const newIndex = containers[containerName]?.env?.length || 0;
    setEditingRow({ containerName, index: newIndex, isNew: true });
  };

  // Handle starting edit on a row - capture original values for revert
  const handleStartEdit = (containerName: string, index: number) => {
    const envVar = containers[containerName]?.env?.[index];
    setEditingRow({
      containerName,
      index,
      // Deep copy to preserve original values
      originalEnvVar: envVar ? { ...envVar } : undefined,
    });
  };

  // Handle applying changes - removes empty rows
  const handleApplyEdit = () => {
    if (editingRow) {
      const envVar =
        containers[editingRow.containerName]?.env?.[editingRow.index];
      // If both key and value are empty, remove the row
      if (isEnvVarEmpty(envVar)) {
        handleRemoveEnvVar(editingRow.containerName, editingRow.index);
        return;
      }
    }
    setEditingRow(null);
  };

  // Handle canceling edit
  const handleCancelEdit = () => {
    if (!editingRow) return;

    if (editingRow.isNew) {
      // NEW row: Cancel = Delete the row entirely
      handleRemoveEnvVar(editingRow.containerName, editingRow.index);
    } else if (editingRow.originalEnvVar) {
      // EXISTING row: Cancel = Revert to original values
      const { containerName, index, originalEnvVar } = editingRow;
      onEnvVarChange(containerName, index, 'key', originalEnvVar.key || '');
      onEnvVarChange(
        containerName,
        index,
        'value',
        originalEnvVar.value as any,
      );
      onEnvVarChange(
        containerName,
        index,
        'valueFrom',
        originalEnvVar.valueFrom as any,
      );
      setEditingRow(null);
    } else {
      setEditingRow(null);
    }
  };

  // Toggle base value expansion for overridden rows
  const toggleBaseExpanded = (key: string) => {
    setExpandedBaseRows(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Handle starting override of an inherited env var
  const handleStartOverride = (containerName: string, envVar: EnvVar) => {
    onStartOverride?.(containerName, envVar);
    // After override is added, set it to editing mode
    const newIndex = containers[containerName]?.env?.length || 0;
    setEditingRow({ containerName, index: newIndex });
  };

  // Check if a specific row is being edited
  const isRowEditing = (containerName: string, index: number) => {
    return (
      editingRow?.containerName === containerName && editingRow?.index === index
    );
  };

  return (
    <Box>
      {containerEntries.map(([containerName, container]) => (
        <Card key={containerName} className={classes.containerCard}>
          <CardHeader
            style={{ paddingBottom: 8 }}
            title={
              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
              >
                <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
                  {containerName === 'main' ? 'app' : containerName}
                </Typography>
                <IconButton
                  onClick={() => handleRemoveContainer(containerName)}
                  color="secondary"
                  size="small"
                  disabled={disabled}
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            }
          />
          <CardContent style={{ paddingTop: 8 }}>
            <Grid container spacing={2}>
              {!hideContainerFields && (
                <>
                  <Grid item xs={12}>
                    <Box mb={2}>
                      <ImageSelector
                        image={container.image}
                        builds={builds}
                        disabled={disabled}
                        onChange={value =>
                          onContainerChange(containerName, 'image', value)
                        }
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Command"
                      value={container.command?.join(', ') || ''}
                      onChange={e =>
                        onArrayFieldChange(
                          containerName,
                          'command',
                          e.target.value,
                        )
                      }
                      fullWidth
                      variant="outlined"
                      placeholder="Comma-separated commands"
                      helperText="Separate multiple commands with commas"
                      disabled={disabled}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Arguments"
                      value={container.args?.join(', ') || ''}
                      onChange={e =>
                        onArrayFieldChange(
                          containerName,
                          'args',
                          e.target.value,
                        )
                      }
                      fullWidth
                      variant="outlined"
                      placeholder="Comma-separated arguments"
                      helperText="Separate multiple arguments with commas"
                      disabled={disabled}
                    />
                  </Grid>
                </>
              )}
            </Grid>

            {/* Environment Variables */}
            <Box mt={3}>
              <Typography
                variant="subtitle2"
                gutterBottom
                style={{ fontWeight: 600 }}
              >
                Environment Variables
              </Typography>
              {showEnvVarStatus && baseWorkloadData
                ? // Show unified list with status badges (overrides view)
                  (() => {
                    const baseEnvVars = getBaseEnvVarsForContainer(
                      baseWorkloadData,
                      containerName,
                    );
                    const overrideEnvVars = container.env || [];
                    const mergedEnvVars = mergeEnvVarsWithStatus(
                      baseEnvVars,
                      overrideEnvVars,
                    );

                    return mergedEnvVars.map((item, displayIndex) => {
                      if (item.status === 'inherited') {
                        // Inherited env var - show read-only row with override button
                        return (
                          <Box
                            key={`inherited-${item.envVar.key}`}
                            className={classes.envVarRowWrapper}
                          >
                            <Box className={classes.statusBadgeWrapper}>
                              <EnvVarStatusBadge status={item.status} />
                            </Box>
                            <Box className={classes.inheritedRow}>
                              <Box className={classes.inheritedContent}>
                                <Typography className={classes.inheritedKey}>
                                  {item.envVar.key}
                                </Typography>
                                <Typography className={classes.inheritedValue}>
                                  {formatEnvVarValue(item.envVar)}
                                </Typography>
                              </Box>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<EditIcon />}
                                className={classes.overrideButton}
                                disabled={disabled || isAnyRowEditing}
                                onClick={() =>
                                  handleStartOverride(
                                    containerName,
                                    item.envVar,
                                  )
                                }
                              >
                                Override
                              </Button>
                            </Box>
                          </Box>
                        );
                      }

                      // Overridden or new env var - use actualIndex from merged data
                      const actualIndex = item.actualIndex!;
                      const isCurrentlyEditing = isRowEditing(
                        containerName,
                        actualIndex,
                      );
                      const currentMode = envModes.getMode(
                        containerName,
                        actualIndex,
                      );

                      return (
                        <Box
                          key={`${item.status}-${item.envVar.key}-${displayIndex}`}
                          className={classes.envVarRowWrapper}
                        >
                          <Box className={classes.statusBadgeWrapper}>
                            <EnvVarStatusBadge
                              status={item.status}
                              baseValue={item.baseValue}
                            />
                          </Box>
                          <EnvVarEditor
                            envVar={item.envVar}
                            secrets={secretOptions}
                            disabled={disabled}
                            mode={currentMode}
                            isEditing={isCurrentlyEditing}
                            onEdit={() =>
                              handleStartEdit(containerName, actualIndex)
                            }
                            onApply={handleApplyEdit}
                            onCancel={handleCancelEdit}
                            editButtonLabel="Edit"
                            lockMode={item.status === 'overridden'}
                            lockKey={item.status === 'overridden'}
                            editDisabled={
                              isAnyRowEditing && !isCurrentlyEditing
                            }
                            baseValue={item.baseValue}
                            showBaseValue={expandedBaseRows.has(
                              item.envVar.key,
                            )}
                            onToggleBaseValue={
                              item.status === 'overridden' && item.baseValue
                                ? () => toggleBaseExpanded(item.envVar.key)
                                : undefined
                            }
                            onChange={(field, value) =>
                              onEnvVarChange(
                                containerName,
                                actualIndex,
                                field,
                                value,
                              )
                            }
                            onRemove={() =>
                              handleRemoveEnvVar(containerName, actualIndex)
                            }
                            onModeChange={mode =>
                              handleEnvVarModeChange(
                                containerName,
                                actualIndex,
                                mode,
                              )
                            }
                          />
                        </Box>
                      );
                    });
                  })()
                : // Standard view without status badges (workload view)
                  container.env?.map((envVar, index) => {
                    const isCurrentlyEditing = isRowEditing(
                      containerName,
                      index,
                    );
                    return (
                      <Box key={index} className={classes.envVarRowWrapper}>
                        <EnvVarEditor
                          envVar={envVar}
                          secrets={secretOptions}
                          disabled={disabled}
                          mode={envModes.getMode(containerName, index)}
                          isEditing={isCurrentlyEditing}
                          onEdit={() => handleStartEdit(containerName, index)}
                          onApply={handleApplyEdit}
                          onCancel={handleCancelEdit}
                          editButtonLabel="Edit"
                          editDisabled={isAnyRowEditing && !isCurrentlyEditing}
                          onChange={(field, value) =>
                            onEnvVarChange(containerName, index, field, value)
                          }
                          onRemove={() =>
                            handleRemoveEnvVar(containerName, index)
                          }
                          onModeChange={mode =>
                            handleEnvVarModeChange(containerName, index, mode)
                          }
                        />
                      </Box>
                    );
                  })}
              <Button
                startIcon={<AddIcon />}
                onClick={() => handleAddEnvVar(containerName)}
                variant="outlined"
                size="small"
                className={classes.addButton}
                disabled={disabled || isAnyRowEditing}
                color="primary"
              >
                Add Environment Variable
              </Button>
            </Box>

            {/* File Mounts */}
            <Box mt={3}>
              <Typography
                variant="subtitle2"
                gutterBottom
                style={{ fontWeight: 600 }}
              >
                File Mounts
              </Typography>
              {(container as any).files?.map(
                (fileVar: FileVar, index: number) => (
                  <FileVarEditor
                    key={index}
                    fileVar={fileVar}
                    id={`${containerName}-${index}`}
                    secrets={secretOptions}
                    disabled={disabled}
                    mode={fileModes.getMode(containerName, index)}
                    onChange={(field, value) =>
                      onFileVarChange(containerName, index, field, value)
                    }
                    onRemove={() => handleRemoveFileVar(containerName, index)}
                    onModeChange={mode =>
                      handleFileVarModeChange(containerName, index, mode)
                    }
                  />
                ),
              )}
              <Button
                startIcon={<AddIcon />}
                onClick={() => onAddFileVar(containerName)}
                variant="outlined"
                size="small"
                className={classes.addButton}
                disabled={disabled}
                color="primary"
              >
                Add File Mount
              </Button>
            </Box>
          </CardContent>
        </Card>
      ))}

      {showAddButton && (
        <Button
          startIcon={<AddIcon />}
          onClick={onAddContainer}
          variant="contained"
          color="primary"
          className={classes.addButton}
          disabled={disabled}
        >
          Add Container
        </Button>
      )}
    </Box>
  );
}
