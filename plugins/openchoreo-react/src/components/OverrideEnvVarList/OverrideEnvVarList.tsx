import { useState, useMemo, type FC } from 'react';
import { Box, Button, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import EditIcon from '@material-ui/icons/Edit';
import type { EnvVar } from '@openchoreo/backstage-plugin-common';
import type { SecretOption } from '@openchoreo/backstage-design-system';
import { EnvVarEditor } from '../EnvVarEditor';
import { EnvVarStatusBadge } from '../EnvVarStatusBadge';
import type { UseModeStateResult } from '../../hooks/useModeState';
import type { UseEnvVarEditBufferResult } from '../../hooks/useEnvVarEditBuffer';
import {
  mergeEnvVarsWithStatus,
  formatEnvVarValue,
} from '../../utils/envVarUtils';

const useStyles = makeStyles(theme => ({
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
  addButton: {
    marginTop: theme.spacing(1),
  },
}));

export interface OverrideEnvVarListProps {
  /** Container name for tracking edit state */
  containerName: string;
  /** Override environment variables (from form state) */
  envVars: EnvVar[];
  /** Base workload environment variables (for comparison) */
  baseEnvVars: EnvVar[];
  /** Available secrets for reference selection */
  secretOptions: SecretOption[];
  /** Plain/secret mode state manager */
  envModes: UseModeStateResult;
  /** Whether editing is disabled */
  disabled: boolean;
  /** Edit buffer state and handlers from useEnvVarEditBuffer */
  editBuffer: UseEnvVarEditBufferResult;
  /** Callback when starting to override inherited var */
  onStartOverride: (containerName: string, envVar: EnvVar) => void;
  /** Callback when env var field changes (for non-editing mode) */
  onEnvVarChange: (
    containerName: string,
    index: number,
    field: keyof EnvVar,
    value: any,
  ) => void;
  /** Callback when env var should be removed */
  onRemoveEnvVar: (containerName: string, index: number) => void;
  /** Callback when env var mode changes */
  onEnvVarModeChange: (
    containerName: string,
    index: number,
    mode: 'plain' | 'secret',
  ) => void;
  /** Callback to add new env var */
  onAddEnvVar: (containerName: string) => void;
}

/**
 * Override-aware environment variable list.
 * Shows unified list with inherited (read-only) + overridden/new (editable) env vars.
 * Displays status badges and supports inline override creation.
 */
export const OverrideEnvVarList: FC<OverrideEnvVarListProps> = ({
  containerName,
  envVars,
  baseEnvVars,
  secretOptions,
  envModes,
  disabled,
  editBuffer,
  onStartOverride,
  onEnvVarChange,
  onRemoveEnvVar,
  onEnvVarModeChange,
  onAddEnvVar,
}) => {
  const classes = useStyles();

  // Track which overridden rows have base value expanded
  const [expandedBaseRows, setExpandedBaseRows] = useState<Set<string>>(
    new Set(),
  );

  // Merge base and override env vars with status metadata
  const mergedEnvVars = useMemo(
    () => mergeEnvVarsWithStatus(baseEnvVars, envVars),
    [baseEnvVars, envVars],
  );

  const handleAddEnvVar = () => {
    onAddEnvVar(containerName);
    const newIndex = envVars.length;
    editBuffer.startNew(containerName, newIndex);
  };

  const handleRemoveEnvVar = (index: number) => {
    envModes.cleanupIndex(containerName, index);
    onRemoveEnvVar(containerName, index);
  };

  const handleModeChange = (index: number, mode: 'plain' | 'secret') => {
    envModes.setMode(containerName, index, mode);

    const isEditing = editBuffer.isRowEditing(containerName, index);

    if (isEditing && editBuffer.editBuffer) {
      // Update buffer when mode changes during editing
      if (mode === 'plain') {
        editBuffer.setBuffer({
          ...editBuffer.editBuffer,
          value: '',
          valueFrom: undefined,
        });
      } else {
        editBuffer.setBuffer({
          ...editBuffer.editBuffer,
          value: undefined,
          valueFrom: { secretRef: { name: '', key: '' } },
        });
      }
    } else {
      // Update parent state directly (non-editing mode changes)
      onEnvVarModeChange(containerName, index, mode);
    }
  };

  // Handle starting override of an inherited env var
  const handleStartOverride = (envVar: EnvVar) => {
    onStartOverride(containerName, envVar);
    // After override is added, set it to editing mode with buffer initialized
    const newIndex = envVars.length;
    // Initialize buffer with a copy of the base env var
    editBuffer.startNew(containerName, newIndex, envVar);
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

  return (
    <Box>
      {mergedEnvVars.map((item, displayIndex) => {
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
                  disabled={disabled || editBuffer.isAnyRowEditing}
                  onClick={() => handleStartOverride(item.envVar)}
                >
                  Override
                </Button>
              </Box>
            </Box>
          );
        }

        // Overridden or new env var - use actualIndex from merged data
        const actualIndex = item.actualIndex!;
        const isCurrentlyEditing = editBuffer.isRowEditing(
          containerName,
          actualIndex,
        );
        const currentMode = envModes.getMode(containerName, actualIndex);

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
              envVar={
                isCurrentlyEditing && editBuffer.editBuffer
                  ? editBuffer.editBuffer
                  : item.envVar
              }
              secrets={secretOptions}
              disabled={disabled}
              mode={currentMode}
              isEditing={isCurrentlyEditing}
              onEdit={() => editBuffer.startEdit(containerName, actualIndex)}
              onApply={editBuffer.applyEdit}
              onCancel={editBuffer.cancelEdit}
              editButtonLabel="Edit"
              lockMode={item.status === 'overridden'}
              lockKey={item.status === 'overridden'}
              editDisabled={editBuffer.isAnyRowEditing && !isCurrentlyEditing}
              deleteDisabled={editBuffer.isAnyRowEditing && !isCurrentlyEditing}
              baseValue={item.baseValue}
              showBaseValue={expandedBaseRows.has(item.envVar.key)}
              onToggleBaseValue={
                item.status === 'overridden' && item.baseValue
                  ? () => toggleBaseExpanded(item.envVar.key)
                  : undefined
              }
              onChange={
                isCurrentlyEditing
                  ? editBuffer.updateBuffer
                  : (field, value) =>
                      onEnvVarChange(containerName, actualIndex, field, value)
              }
              onRemove={() => handleRemoveEnvVar(actualIndex)}
              onModeChange={mode => handleModeChange(actualIndex, mode)}
            />
          </Box>
        );
      })}
      <Button
        startIcon={<AddIcon />}
        onClick={handleAddEnvVar}
        variant="outlined"
        size="small"
        className={classes.addButton}
        disabled={disabled || editBuffer.isAnyRowEditing}
        color="primary"
      >
        Add Environment Variable
      </Button>
    </Box>
  );
};
