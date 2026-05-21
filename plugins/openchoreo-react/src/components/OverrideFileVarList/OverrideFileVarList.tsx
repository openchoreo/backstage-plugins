import { useMemo, type FC } from 'react';
import { Box, Button, Chip } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import type { FileVar } from '@openchoreo/backstage-plugin-common';
import type { SecretOption } from '@openchoreo/backstage-design-system';
import { FileVarEditor } from '../FileVarEditor';
import { GroupedSection } from '../GroupedSection';
import type { UseModeStateResult } from '../../hooks/useModeState';
import type { UseFileVarEditBufferResult } from '../../hooks/useFileVarEditBuffer';
import {
  mergeFileVarsWithStatus,
  type FileVarWithStatus,
} from '../../utils/fileVarUtils';
import { groupByStatus } from '../../utils/overrideGroupUtils';

const useStyles = makeStyles(theme => ({
  fileVarRowWrapper: {
    marginBottom: theme.spacing(1),
  },
  inheritedRow: {
    padding: theme.spacing(1.5),
    backgroundColor: theme.palette.grey[50],
    borderRadius: 6,
    border: `1px dashed ${theme.palette.grey[300]}`,
  },
  rowHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(0.5),
  },
  newChip: {
    height: 18,
    fontSize: 10,
    letterSpacing: '0.04em',
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
  /**
   * Override file mounts as initially loaded from the binding. Used to
   * distinguish entries that were already persisted (`extra`) from
   * ones the user just added in this session (`new`).
   */
  initialFileVars?: FileVar[];
  /** Environment name for display in section titles (currently unused). */
  environmentName?: string;
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
  initialFileVars,
  // environmentName intentionally unused — section title is no longer per-env.
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
    () => mergeFileVarsWithStatus(baseFileVars, fileVars, initialFileVars),
    [baseFileVars, fileVars, initialFileVars],
  );

  // Group items by status
  const grouped = useMemo(
    () => groupByStatus(mergedFileVars),
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
          valueFrom: { secretKeyRef: { name: '', key: '' } },
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
        {item.status === 'new' && (
          <Box className={classes.rowHeader}>
            <Chip
              size="small"
              label="NEW"
              color="primary"
              className={classes.newChip}
            />
          </Box>
        )}
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
          applyDisabled={isCurrentlyEditing && !editBuffer.isBufferValid}
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

  // Render an inherited (read-only) file var row using FileVarEditor
  const renderInheritedRow = (item: FileVarWithStatus, index: number) => {
    const baseMode = item.fileVar.valueFrom?.secretKeyRef ? 'secret' : 'plain';
    return (
      <Box
        key={`inherited-${item.fileVar.key}`}
        className={classes.fileVarRowWrapper}
      >
        <FileVarEditor
          fileVar={item.fileVar}
          id={`inherited-${containerName}-${index}`}
          secrets={secretOptions}
          disabled={disabled}
          mode={baseMode}
          isEditing={false}
          onEdit={() => handleStartOverride(item.fileVar)}
          onApply={() => {}}
          editButtonLabel="Override"
          editDisabled={editBuffer.isAnyRowEditing}
          hideDelete
          className={classes.inheritedRow}
          onChange={() => {}}
          onRemove={() => {}}
          onModeChange={() => {}}
        />
      </Box>
    );
  };

  return (
    <Box>
      {/* Not in current workload — overrides whose key isn't in the bound release's workload.
          Includes both stale entries already on the binding ('extra') and ones the user
          just added in this form session ('new'). 'new' rows show a NEW chip. */}
      {grouped.extra.length + grouped.new.length > 0 && (
        <GroupedSection
          title="Not in workload"
          titleTooltip="These overrides have no matching file mount in the release's workload spec. They'll still be applied to the environment binding when you save. Common when a previous release had this file, or when you've just added a new one."
          count={grouped.extra.length + grouped.new.length}
          status="new"
          defaultExpanded
        >
          {[...grouped.extra, ...grouped.new].map((item, index) =>
            renderEditableRow(item as FileVarWithStatus, index),
          )}
        </GroupedSection>
      )}

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

      {/* From Workload Config section */}
      {grouped.inherited.length > 0 && (
        <GroupedSection
          title="From Workload Config"
          count={grouped.inherited.length}
          status="inherited"
          defaultExpanded
        >
          {grouped.inherited.map((item, index) =>
            renderInheritedRow(item as FileVarWithStatus, index),
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
