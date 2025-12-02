import { useMemo, type FC } from 'react';
import { Box, Button, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import EditIcon from '@material-ui/icons/Edit';
import type { FileVar } from '@openchoreo/backstage-plugin-common';
import type { SecretOption } from '@openchoreo/backstage-design-system';
import { FileVarEditor } from '../FileVarEditor';
import { StatusSummaryBar } from '../StatusSummaryBar';
import { GroupedSection } from '../GroupedSection';
import type { UseModeStateResult } from '../../hooks/useModeState';
import type { UseFileVarEditBufferResult } from '../../hooks/useFileVarEditBuffer';
import {
  mergeFileVarsWithStatus,
  formatFileVarValue,
  type FileVarWithStatus,
} from '../../utils/fileVarUtils';
import { groupByStatus, getStatusCounts } from '../../utils/overrideGroupUtils';

const useStyles = makeStyles(theme => ({
  fileVarRowWrapper: {
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
  inheritedMountPath: {
    fontSize: '0.8rem',
    color: theme.palette.text.secondary,
    fontFamily: 'monospace',
  },
  inheritedValue: {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
    fontFamily: 'monospace',
    marginTop: theme.spacing(0.25),
  },
  overrideButton: {
    marginLeft: 'auto',
  },
  addButton: {
    marginTop: theme.spacing(1),
  },
}));

export interface OverrideFileVarListProps {
  /** Container name for tracking edit state */
  containerName: string;
  /** Override file mounts (from form state) */
  fileVars: FileVar[];
  /** Base workload file mounts (for comparison) */
  baseFileVars: FileVar[];
  /** Available secrets for reference selection */
  secretOptions: SecretOption[];
  /** Plain/secret mode state manager */
  fileModes: UseModeStateResult;
  /** Whether editing is disabled */
  disabled: boolean;
  /** Edit buffer state and handlers from useFileVarEditBuffer */
  editBuffer: UseFileVarEditBufferResult;
  /** Callback when starting to override inherited file var */
  onStartOverride: (containerName: string, fileVar: FileVar) => void;
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
 * Override-aware file mount list.
 * Shows grouped sections: Overrides, New, and Inherited (Base).
 * Displays status badges and supports inline override creation.
 */
export const OverrideFileVarList: FC<OverrideFileVarListProps> = ({
  containerName,
  fileVars,
  baseFileVars,
  secretOptions,
  fileModes,
  disabled,
  editBuffer,
  onStartOverride,
  onFileVarChange,
  onRemoveFileVar,
  onFileVarModeChange,
  onAddFileVar,
}) => {
  const classes = useStyles();

  // Merge base and override file vars with status metadata
  const mergedFileVars = useMemo(
    () => mergeFileVarsWithStatus(baseFileVars, fileVars),
    [baseFileVars, fileVars],
  );

  // Group items by status and get counts
  const grouped = useMemo(
    () => groupByStatus(mergedFileVars),
    [mergedFileVars],
  );

  const counts = useMemo(
    () => getStatusCounts(mergedFileVars),
    [mergedFileVars],
  );

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

  // Handle starting override of an inherited file var
  const handleStartOverride = (fileVar: FileVar) => {
    onStartOverride(containerName, fileVar);
    // After override is added, set it to editing mode with buffer initialized
    const newIndex = fileVars.length;
    // Initialize buffer with a copy of the base file var
    editBuffer.startNew(containerName, newIndex, fileVar);
  };

  // Render an editable file var row (overridden or new)
  const renderEditableRow = (item: FileVarWithStatus, displayIndex: number) => {
    const actualIndex = item.actualIndex!;
    const isCurrentlyEditing = editBuffer.isRowEditing(
      containerName,
      actualIndex,
    );
    const currentMode = fileModes.getMode(containerName, actualIndex);

    return (
      <Box
        key={`${item.status}-${item.fileVar.key}-${displayIndex}`}
        className={classes.fileVarRowWrapper}
      >
        <FileVarEditor
          fileVar={
            isCurrentlyEditing && editBuffer.editBuffer
              ? editBuffer.editBuffer
              : item.fileVar
          }
          id={`${containerName}-${actualIndex}`}
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
          onChange={
            isCurrentlyEditing
              ? editBuffer.updateBuffer
              : (field, value) =>
                  onFileVarChange(containerName, actualIndex, field, value)
          }
          onRemove={() => handleRemoveFileVar(actualIndex)}
          onModeChange={mode => handleModeChange(actualIndex, mode)}
        />
      </Box>
    );
  };

  // Render an inherited (read-only) file var row
  const renderInheritedRow = (item: FileVarWithStatus) => {
    const valueDisplay = formatFileVarValue(item.fileVar);
    return (
      <Box
        key={`inherited-${item.fileVar.key}`}
        className={classes.fileVarRowWrapper}
      >
        <Box className={classes.inheritedRow}>
          <Box className={classes.inheritedContent}>
            <Typography className={classes.inheritedKey}>
              {item.fileVar.key}
            </Typography>
            <Typography className={classes.inheritedMountPath}>
              → {item.fileVar.mountPath}
            </Typography>
            {valueDisplay && (
              <Typography className={classes.inheritedValue}>
                {valueDisplay}
              </Typography>
            )}
          </Box>
          <Button
            size="small"
            variant="outlined"
            startIcon={<EditIcon />}
            className={classes.overrideButton}
            disabled={disabled || editBuffer.isAnyRowEditing}
            onClick={() => handleStartOverride(item.fileVar)}
          >
            Override
          </Button>
        </Box>
      </Box>
    );
  };

  return (
    <Box>
      {/* Status summary bar */}
      <StatusSummaryBar counts={counts} />

      {/* Overrides section */}
      {grouped.overridden.length > 0 && (
        <GroupedSection
          title="Overrides"
          count={grouped.overridden.length}
          status="overridden"
          defaultExpanded
        >
          {grouped.overridden.map((item, index) =>
            renderEditableRow(item as FileVarWithStatus, index),
          )}
        </GroupedSection>
      )}

      {/* New section */}
      {grouped.new.length > 0 && (
        <GroupedSection
          title="New"
          count={grouped.new.length}
          status="new"
          defaultExpanded
        >
          {grouped.new.map((item, index) =>
            renderEditableRow(item as FileVarWithStatus, index),
          )}
        </GroupedSection>
      )}

      {/* Inherited section */}
      {grouped.inherited.length > 0 && (
        <GroupedSection
          title="Inherited"
          count={grouped.inherited.length}
          status="inherited"
          defaultExpanded
        >
          {grouped.inherited.map(item =>
            renderInheritedRow(item as FileVarWithStatus),
          )}
        </GroupedSection>
      )}

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
