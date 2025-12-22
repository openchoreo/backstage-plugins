import type { FC } from 'react';
import { Box, Button } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import type { Connection } from '@openchoreo/backstage-plugin-common';
import {
  ConnectionEditor,
  type ConnectionTypeOption,
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
  connections: { [key: string]: Connection };
  /** Whether editing is disabled */
  disabled: boolean;
  /** Edit buffer state and handlers from useConnectionEditBuffer */
  editBuffer: UseConnectionEditBufferResult;
  /** Callback when connection should be removed */
  onRemoveConnection: (connectionName: string) => void;
  /** Callback to add new connection (returns the new connection name) */
  onAddConnection: () => string;
  /** Available connection types */
  connectionTypes: ConnectionTypeOption[];
  /** Callback to get projects for a connection */
  getProjects: (connectionName: string) => ProjectOption[];
  /** Callback to get components for a connection */
  getComponents: (connectionName: string) => ComponentOption[];
  /** Callback to get endpoints for a connection */
  getEndpoints: (connectionName: string) => EndpointOption[];
  /** Callback when connection type changes */
  onTypeChange: (connectionName: string, type: string) => void;
  /** Callback when project changes */
  onProjectChange: (connectionName: string, projectName: string) => void;
  /** Callback when component changes */
  onComponentChange: (connectionName: string, componentName: string) => void;
  /** Callback when endpoint changes */
  onEndpointChange: (connectionName: string, endpoint: string) => void;
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
  connectionTypes,
  getProjects,
  getComponents,
  getEndpoints,
  onTypeChange,
  onProjectChange,
  onComponentChange,
  onEndpointChange,
}) => {
  const classes = useStyles();

  const handleAddConnection = () => {
    const newConnectionName = onAddConnection();
    editBuffer.startNew(newConnectionName);
  };

  const handleRemoveConnection = (connectionName: string) => {
    // If deleting the row being edited, clear edit state first
    if (editBuffer.isRowEditing(connectionName)) {
      editBuffer.clearEditState();
    }
    onRemoveConnection(connectionName);
  };

  const connectionEntries = Object.entries(connections);

  return (
    <Box>
      {connectionEntries.map(([connectionName, connection]) => {
        const isCurrentlyEditing = editBuffer.isRowEditing(connectionName);
        const effectiveConnectionName =
          isCurrentlyEditing && editBuffer.editBufferName !== null
            ? editBuffer.editBufferName
            : connectionName;
        const effectiveConnection =
          isCurrentlyEditing && editBuffer.editBuffer
            ? editBuffer.editBuffer
            : connection;

        return (
          <Box key={connectionName} className={classes.rowWrapper}>
            <ConnectionEditor
              connectionName={effectiveConnectionName}
              connection={effectiveConnection}
              disabled={disabled}
              isEditing={isCurrentlyEditing}
              onEdit={() => editBuffer.startEdit(connectionName)}
              onApply={editBuffer.applyEdit}
              onCancel={editBuffer.cancelEdit}
              editDisabled={editBuffer.isAnyRowEditing && !isCurrentlyEditing}
              deleteDisabled={editBuffer.isAnyRowEditing && !isCurrentlyEditing}
              applyDisabled={isCurrentlyEditing && !editBuffer.isBufferValid}
              connectionTypes={connectionTypes}
              projects={getProjects(connectionName)}
              components={getComponents(connectionName)}
              endpoints={getEndpoints(connectionName)}
              onTypeChange={type => {
                if (isCurrentlyEditing) {
                  editBuffer.updateBuffer('type', type);
                }
                onTypeChange(connectionName, type);
              }}
              onProjectChange={projectName => {
                if (isCurrentlyEditing) {
                  editBuffer.updateBufferParams('projectName', projectName);
                  editBuffer.updateBufferParams('componentName', '');
                  editBuffer.updateBufferParams('endpoint', '');
                }
                onProjectChange(connectionName, projectName);
              }}
              onComponentChange={componentName => {
                if (isCurrentlyEditing) {
                  editBuffer.updateBufferParams('componentName', componentName);
                  editBuffer.updateBufferParams('endpoint', '');
                }
                onComponentChange(connectionName, componentName);
              }}
              onEndpointChange={endpoint => {
                if (isCurrentlyEditing) {
                  editBuffer.updateBufferParams('endpoint', endpoint);
                }
                onEndpointChange(connectionName, endpoint);
              }}
              onNameChange={editBuffer.updateBufferName}
              onRemove={() => handleRemoveConnection(connectionName)}
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
