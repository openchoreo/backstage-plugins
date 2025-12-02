import type { FC } from 'react';
import { Box, Button } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import type { EnvVar } from '@openchoreo/backstage-plugin-common';
import type { SecretOption } from '@openchoreo/backstage-design-system';
import { EnvVarEditor } from '../EnvVarEditor';
import type { UseModeStateResult } from '../../hooks/useModeState';
import type { UseEnvVarEditBufferResult } from '../../hooks/useEnvVarEditBuffer';

const useStyles = makeStyles(theme => ({
  envVarRowWrapper: {
    marginBottom: theme.spacing(1),
  },
  addButton: {
    marginTop: theme.spacing(1),
  },
}));

export interface StandardEnvVarListProps {
  /** Container name for tracking edit state */
  containerName: string;
  /** Environment variables to display */
  envVars: EnvVar[];
  /** Available secrets for reference selection */
  secretOptions: SecretOption[];
  /** Plain/secret mode state manager */
  envModes: UseModeStateResult;
  /** Whether editing is disabled */
  disabled: boolean;
  /** Edit buffer state and handlers from useEnvVarEditBuffer */
  editBuffer: UseEnvVarEditBufferResult;
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
 * Standard environment variable list for workload editing.
 * Simple list rendering with inline editing support.
 * No status badges, no base values, no merging.
 */
export const StandardEnvVarList: FC<StandardEnvVarListProps> = ({
  containerName,
  envVars,
  secretOptions,
  envModes,
  disabled,
  editBuffer,
  onEnvVarChange,
  onRemoveEnvVar,
  onEnvVarModeChange,
  onAddEnvVar,
}) => {
  const classes = useStyles();

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

  return (
    <Box>
      {envVars.map((envVar, index) => {
        const isCurrentlyEditing = editBuffer.isRowEditing(
          containerName,
          index,
        );
        const currentMode = envModes.getMode(containerName, index);

        return (
          <Box key={index} className={classes.envVarRowWrapper}>
            <EnvVarEditor
              envVar={
                isCurrentlyEditing && editBuffer.editBuffer
                  ? editBuffer.editBuffer
                  : envVar
              }
              secrets={secretOptions}
              disabled={disabled}
              mode={currentMode}
              isEditing={isCurrentlyEditing}
              onEdit={() => editBuffer.startEdit(containerName, index)}
              onApply={editBuffer.applyEdit}
              onCancel={editBuffer.cancelEdit}
              editButtonLabel="Edit"
              editDisabled={editBuffer.isAnyRowEditing && !isCurrentlyEditing}
              deleteDisabled={editBuffer.isAnyRowEditing && !isCurrentlyEditing}
              onChange={
                isCurrentlyEditing
                  ? editBuffer.updateBuffer
                  : (field, value) =>
                      onEnvVarChange(containerName, index, field, value)
              }
              onRemove={() => handleRemoveEnvVar(index)}
              onModeChange={mode => handleModeChange(index, mode)}
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
