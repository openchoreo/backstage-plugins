import type { FC } from 'react';
import { Box, Button } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import type { Connection } from '@openchoreo/backstage-plugin-common';
import {
  DependencyEditor,
  type ProjectOption,
  type ComponentOption,
  type EndpointOption,
} from '../ConnectionEditor';
import type { UseDependencyEditBufferResult } from '../../hooks/useConnectionEditBuffer';

const useStyles = makeStyles(theme => ({
  rowWrapper: {
    marginBottom: theme.spacing(1),
  },
  addButton: {
    marginTop: theme.spacing(1),
  },
}));

export interface DependencyListProps {
  /** Dependencies to display */
  dependencies: Connection[];
  /** Whether editing is disabled */
  disabled: boolean;
  /** Edit buffer state and handlers from useDependencyEditBuffer */
  editBuffer: UseDependencyEditBufferResult;
  /** Callback when dependency should be removed */
  onRemoveDependency: (index: number) => void;
  /** Callback to add new dependency (returns the new index) */
  onAddDependency: () => number;
  /** Callback to get projects for a dependency */
  getProjects: (index: number) => ProjectOption[];
  /** Callback to get components for a dependency */
  getComponents: (index: number) => ComponentOption[];
  /** Callback to get endpoints for a dependency */
  getEndpoints: (index: number) => EndpointOption[];
  /** Callback when project changes */
  onProjectChange: (index: number, projectName: string) => void;
  /** Callback when component changes */
  onComponentChange: (index: number, componentName: string) => void;
  /** Callback when endpoint changes */
  onEndpointChange: (index: number, endpoint: string) => void;
  /** Callback to get available visibility options for a dependency */
  getAvailableVisibilities: (index: number) => ('project' | 'namespace')[];
}

/** @deprecated Use DependencyListProps instead */
export type ConnectionListProps = DependencyListProps;

/**
 * Dependency list with inline editing support.
 * Only one dependency can be edited at a time.
 */
export const DependencyList: FC<DependencyListProps> = ({
  dependencies,
  disabled,
  editBuffer,
  onRemoveDependency,
  onAddDependency,
  getProjects,
  getComponents,
  getEndpoints,
  onProjectChange,
  onComponentChange,
  onEndpointChange,
  getAvailableVisibilities,
}) => {
  const classes = useStyles();

  const handleAddDependency = () => {
    const newIndex = onAddDependency();
    editBuffer.startNew(newIndex);
  };

  const handleRemoveDependency = (index: number) => {
    // If deleting the row being edited, clear edit state first
    if (editBuffer.isRowEditing(index)) {
      editBuffer.clearEditState();
    }
    onRemoveDependency(index);
  };

  return (
    <Box>
      {dependencies.map((dependency, index) => {
        const isCurrentlyEditing = editBuffer.isRowEditing(index);
        const effectiveDependency =
          isCurrentlyEditing && editBuffer.editBuffer
            ? editBuffer.editBuffer
            : dependency;

        return (
          <Box key={index} className={classes.rowWrapper}>
            <DependencyEditor
              index={index}
              dependency={effectiveDependency}
              disabled={disabled}
              isEditing={isCurrentlyEditing}
              onEdit={() => editBuffer.startEdit(index)}
              onApply={editBuffer.applyEdit}
              onCancel={editBuffer.cancelEdit}
              editDisabled={editBuffer.isAnyRowEditing && !isCurrentlyEditing}
              deleteDisabled={editBuffer.isAnyRowEditing && !isCurrentlyEditing}
              applyDisabled={isCurrentlyEditing && !editBuffer.isBufferValid}
              projects={getProjects(index)}
              components={getComponents(index)}
              endpoints={getEndpoints(index)}
              onProjectChange={projectName => {
                if (isCurrentlyEditing) {
                  editBuffer.updateBuffer('project', projectName);
                  editBuffer.updateBuffer('component', '');
                  editBuffer.updateBuffer('name', '');
                  editBuffer.updateBuffer('visibility', '');
                }
                onProjectChange(index, projectName);
              }}
              onComponentChange={componentName => {
                if (isCurrentlyEditing) {
                  editBuffer.updateBuffer('component', componentName);
                  editBuffer.updateBuffer('name', '');
                  editBuffer.updateBuffer('visibility', '');
                }
                onComponentChange(index, componentName);
              }}
              onEndpointChange={endpoint => {
                if (isCurrentlyEditing) {
                  editBuffer.updateBuffer('name', endpoint);
                  // Reset visibility since available options may change
                  editBuffer.updateBuffer('visibility', '');
                }
                onEndpointChange(index, endpoint);
              }}
              availableVisibilities={getAvailableVisibilities(index)}
              onVisibilityChange={visibility => {
                if (isCurrentlyEditing) {
                  editBuffer.updateBuffer('visibility', visibility);
                }
              }}
              onEnvBindingChange={(field, value) => {
                if (isCurrentlyEditing) {
                  editBuffer.updateBufferEnvBindings(field, value);
                }
              }}
              onRemove={() => handleRemoveDependency(index)}
            />
          </Box>
        );
      })}
      <Button
        startIcon={<AddIcon />}
        onClick={handleAddDependency}
        variant="outlined"
        size="small"
        className={classes.addButton}
        disabled={disabled || editBuffer.isAnyRowEditing}
        color="primary"
      >
        Add Dependency
      </Button>
    </Box>
  );
};

/** @deprecated Use DependencyList instead */
export const ConnectionList = DependencyList;
