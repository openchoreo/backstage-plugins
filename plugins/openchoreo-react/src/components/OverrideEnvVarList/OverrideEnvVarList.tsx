import { useMemo, type FC } from 'react';
import { Box, Button } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import type { EnvVar } from '@openchoreo/backstage-plugin-common';
import type { SecretOption } from '@openchoreo/backstage-design-system';
import { EnvVarEditor } from '../EnvVarEditor';
import { StatusSummaryBar } from '../StatusSummaryBar';
import { GroupedSection } from '../GroupedSection';
import type { UseModeStateResult } from '../../hooks/useModeState';
import type { UseEnvVarEditBufferResult } from '../../hooks/useEnvVarEditBuffer';
import {
  mergeEnvVarsWithStatus,
  type EnvVarWithStatus,
} from '../../utils/envVarUtils';
import { groupByStatus, getStatusCounts } from '../../utils/overrideGroupUtils';

const useStyles = makeStyles(theme => ({
  envVarRowWrapper: {
    marginBottom: theme.spacing(1),
  },
  inheritedRow: {
    padding: theme.spacing(1.5),
    backgroundColor: theme.palette.grey[50],
    borderRadius: 6,
    border: `1px dashed ${theme.palette.grey[300]}`,
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
 * Shows grouped sections: Overrides, New, and Inherited (Base).
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

  // Merge base and override env vars with status metadata
  const mergedEnvVars = useMemo(
    () => mergeEnvVarsWithStatus(baseEnvVars, envVars),
    [baseEnvVars, envVars],
  );

  // Group items by status and get counts
  const grouped = useMemo(() => groupByStatus(mergedEnvVars), [mergedEnvVars]);

  const counts = useMemo(() => getStatusCounts(mergedEnvVars), [mergedEnvVars]);

  const handleAddEnvVar = () => {
    onAddEnvVar(containerName);
    const newIndex = envVars.length;
    editBuffer.startNew(containerName, newIndex);
  };

  const handleRemoveEnvVar = (index: number) => {
    // If deleting the row being edited, clear edit state first
    if (editBuffer.isRowEditing(containerName, index)) {
      editBuffer.clearEditState();
    }
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

  // Render an editable env var row (overridden or new)
  const renderEditableRow = (item: EnvVarWithStatus, displayIndex: number) => {
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
  };

  // Render an inherited (read-only) env var row using EnvVarEditor
  const renderInheritedRow = (item: EnvVarWithStatus) => {
    const baseMode = item.envVar.valueFrom?.secretRef ? 'secret' : 'plain';
    return (
      <Box
        key={`inherited-${item.envVar.key}`}
        className={classes.envVarRowWrapper}
      >
        <EnvVarEditor
          envVar={item.envVar}
          secrets={secretOptions}
          disabled={disabled}
          mode={baseMode}
          isEditing={false}
          onEdit={() => handleStartOverride(item.envVar)}
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
            renderEditableRow(item as EnvVarWithStatus, index),
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
            renderEditableRow(item as EnvVarWithStatus, index),
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
            renderInheritedRow(item as EnvVarWithStatus),
          )}
        </GroupedSection>
      )}

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
