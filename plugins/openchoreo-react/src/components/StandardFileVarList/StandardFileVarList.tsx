import type { FC } from 'react';
import { Box, Button } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import type { FileVar } from '@openchoreo/backstage-plugin-common';
import type { SecretOption } from '@openchoreo/backstage-design-system';
import { FileVarEditor } from '../FileVarEditor';
import type { UseModeStateResult } from '../../hooks/useModeState';
import type { UseFileVarEditBufferResult } from '../../hooks/useFileVarEditBuffer';

const useStyles = makeStyles(theme => ({
  fileVarRowWrapper: {
    marginBottom: theme.spacing(1),
  },
  addButton: {
    marginTop: theme.spacing(1),
  },
}));

export interface StandardFileVarListProps {
  /** Container name for tracking edit state */
  containerName: string;
  /** File mounts to display */
  fileVars: FileVar[];
  /** Available secrets for reference selection */
  secretOptions: SecretOption[];
  /** Plain/secret mode state manager */
  fileModes: UseModeStateResult;
  /** Whether editing is disabled */
  disabled: boolean;
  /** Edit buffer state and handlers from useFileVarEditBuffer */
  editBuffer: UseFileVarEditBufferResult;
  /** Callback when file var field changes (for non-editing mode) */
  onFileVarChange: (
    containerName: string,
    index: number,
    field: keyof FileVar,
    value: any,
  ) => void;
  /** Callback when file var should be removed */
  onRemoveFileVar: (containerName: string, index: number) => void;
  /** Callback when file var mode changes */
  onFileVarModeChange: (
    containerName: string,
    index: number,
    mode: 'plain' | 'secret',
  ) => void;
  /** Callback to add new file var */
  onAddFileVar: (containerName: string) => void;
}

/**
 * Standard file mount list for workload editing.
 * Simple list rendering with inline editing support.
 * No status badges, no base values, no merging.
 */
export const StandardFileVarList: FC<StandardFileVarListProps> = ({
  containerName,
  fileVars,
  secretOptions,
  fileModes,
  disabled,
  editBuffer,
  onFileVarChange,
  onRemoveFileVar,
  onFileVarModeChange,
  onAddFileVar,
}) => {
  const classes = useStyles();

  const handleAddFileVar = () => {
    onAddFileVar(containerName);
    const newIndex = fileVars.length;
    editBuffer.startNew(containerName, newIndex);
  };

  const handleRemoveFileVar = (index: number) => {
    // If deleting the row being edited, clear edit state first
    if (editBuffer.isRowEditing(containerName, index)) {
      editBuffer.clearEditState();
    }
    fileModes.cleanupIndex(containerName, index);
    onRemoveFileVar(containerName, index);
  };

  const handleModeChange = (index: number, mode: 'plain' | 'secret') => {
    fileModes.setMode(containerName, index, mode);

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
      onFileVarModeChange(containerName, index, mode);
    }
  };

  return (
    <Box>
      {fileVars.map((fileVar, index) => {
        const isCurrentlyEditing = editBuffer.isRowEditing(
          containerName,
          index,
        );
        const currentMode = fileModes.getMode(containerName, index);

        return (
          <Box key={index} className={classes.fileVarRowWrapper}>
            <FileVarEditor
              fileVar={
                isCurrentlyEditing && editBuffer.editBuffer
                  ? editBuffer.editBuffer
                  : fileVar
              }
              id={`${containerName}-${index}`}
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
                      onFileVarChange(containerName, index, field, value)
              }
              onRemove={() => handleRemoveFileVar(index)}
              onModeChange={mode => handleModeChange(index, mode)}
            />
          </Box>
        );
      })}
      <Button
        startIcon={<AddIcon />}
        onClick={handleAddFileVar}
        variant="outlined"
        size="small"
        className={classes.addButton}
        disabled={disabled || editBuffer.isAnyRowEditing}
        color="primary"
      >
        Add File Mount
      </Button>
    </Box>
  );
};
