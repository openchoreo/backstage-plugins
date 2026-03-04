import type { FC } from 'react';
import { Box, Button } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import type { Connection } from '@openchoreo/backstage-plugin-common';
import {
  ConnectionEditor,
  type ProjectOption,
  type ComponentOption,
  type EndpointOption,
} from '../ConnectionEditor';
import type { UseConnectionEditBufferResult } from '../../hooks/useConnectionEditBuffer';

const useStyles = makeStyles(theme => ({
  rowWrapper: {
    marginBottom: theme.spacing(1),
  },
  addButton: {
    marginTop: theme.spacing(1),
  },
}));

export interface ConnectionListProps {
  /** Connections to display */
  connections: Connection[];
  /** Whether editing is disabled */
  disabled: boolean;
  /** Edit buffer state and handlers from useConnectionEditBuffer */
  editBuffer: UseConnectionEditBufferResult;
  /** Callback when connection should be removed */
  onRemoveConnection: (index: number) => void;
  /** Callback to add new connection (returns the new index) */
  onAddConnection: () => number;
  /** Callback to get projects for a connection */
  getProjects: (index: number) => ProjectOption[];
  /** Callback to get components for a connection */
  getComponents: (index: number) => ComponentOption[];
  /** Callback to get endpoints for a connection */
  getEndpoints: (index: number) => EndpointOption[];
  /** Callback when project changes */
  onProjectChange: (index: number, projectName: string) => void;
  /** Callback when component changes */
  onComponentChange: (index: number, componentName: string) => void;
  /** Callback when endpoint changes */
  onEndpointChange: (index: number, endpoint: string) => void;
  /** Callback to get available visibility options for a connection */
  getAvailableVisibilities: (index: number) => ('project' | 'namespace')[];
}

/**
 * Connection list with inline editing support.
 * Only one connection can be edited at a time.
 */
export const ConnectionList: FC<ConnectionListProps> = ({
  connections,
  disabled,
  editBuffer,
  onRemoveConnection,
  onAddConnection,
  getProjects,
  getComponents,
  getEndpoints,
  onProjectChange,
  onComponentChange,
  onEndpointChange,
  getAvailableVisibilities,
}) => {
  const classes = useStyles();

  const handleAddConnection = () => {
    const newIndex = onAddConnection();
    editBuffer.startNew(newIndex);
  };

  const handleRemoveConnection = (index: number) => {
    // If deleting the row being edited, clear edit state first
    if (editBuffer.isRowEditing(index)) {
      editBuffer.clearEditState();
    }
    onRemoveConnection(index);
  };

  return (
    <Box>
      {connections.map((connection, index) => {
        const isCurrentlyEditing = editBuffer.isRowEditing(index);
        const effectiveConnection =
          isCurrentlyEditing && editBuffer.editBuffer
            ? editBuffer.editBuffer
            : connection;

        return (
          <Box key={index} className={classes.rowWrapper}>
            <ConnectionEditor
              index={index}
              connection={effectiveConnection}
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
                  editBuffer.updateBuffer('endpoint', '');
                  editBuffer.updateBuffer('visibility', '');
                }
                onProjectChange(index, projectName);
              }}
              onComponentChange={componentName => {
                if (isCurrentlyEditing) {
                  editBuffer.updateBuffer('component', componentName);
                  editBuffer.updateBuffer('endpoint', '');
                  editBuffer.updateBuffer('visibility', '');
                }
                onComponentChange(index, componentName);
              }}
              onEndpointChange={endpoint => {
                if (isCurrentlyEditing) {
                  editBuffer.updateBuffer('endpoint', endpoint);
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
              onRemove={() => handleRemoveConnection(index)}
            />
          </Box>
        );
      })}
      <Button
        startIcon={<AddIcon />}
        onClick={handleAddConnection}
        variant="outlined"
        size="small"
        className={classes.addButton}
        disabled={disabled || editBuffer.isAnyRowEditing}
        color="primary"
      >
        Add Connection
      </Button>
    </Box>
  );
};
