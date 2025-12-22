import type { FC } from 'react';
import { Box, Button } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import type { WorkloadEndpoint } from '@openchoreo/backstage-plugin-common';
import { EndpointEditor } from '../EndpointEditor';
import type { UseEndpointEditBufferResult } from '../../hooks/useEndpointEditBuffer';

const useStyles = makeStyles(theme => ({
  rowWrapper: {
    marginBottom: theme.spacing(1),
  },
  addButton: {
    marginTop: theme.spacing(1),
  },
}));

export interface EndpointListProps {
  /** Endpoints to display */
  endpoints: { [key: string]: WorkloadEndpoint };
  /** Whether editing is disabled */
  disabled: boolean;
  /** Edit buffer state and handlers from useEndpointEditBuffer */
  editBuffer: UseEndpointEditBufferResult;
  /** Callback when endpoint should be removed */
  onRemoveEndpoint: (endpointName: string) => void;
  /** Callback to add new endpoint (returns the new endpoint name) */
  onAddEndpoint: () => string;
}

/**
 * Endpoint list with inline editing support.
 * Only one endpoint can be edited at a time.
 */
export const EndpointList: FC<EndpointListProps> = ({
  endpoints,
  disabled,
  editBuffer,
  onRemoveEndpoint,
  onAddEndpoint,
}) => {
  const classes = useStyles();

  const handleAddEndpoint = () => {
    const newEndpointName = onAddEndpoint();
    editBuffer.startNew(newEndpointName);
  };

  const handleRemoveEndpoint = (endpointName: string) => {
    // If deleting the row being edited, clear edit state first
    if (editBuffer.isRowEditing(endpointName)) {
      editBuffer.clearEditState();
    }
    onRemoveEndpoint(endpointName);
  };

  const endpointEntries = Object.entries(endpoints);

  return (
    <Box>
      {endpointEntries.map(([endpointName, endpoint]) => {
        const isCurrentlyEditing = editBuffer.isRowEditing(endpointName);

        return (
          <Box key={endpointName} className={classes.rowWrapper}>
            <EndpointEditor
              endpointName={
                isCurrentlyEditing && editBuffer.editBufferName !== null
                  ? editBuffer.editBufferName
                  : endpointName
              }
              endpoint={
                isCurrentlyEditing && editBuffer.editBuffer
                  ? editBuffer.editBuffer
                  : endpoint
              }
              disabled={disabled}
              isEditing={isCurrentlyEditing}
              onEdit={() => editBuffer.startEdit(endpointName)}
              onApply={editBuffer.applyEdit}
              onCancel={editBuffer.cancelEdit}
              editDisabled={editBuffer.isAnyRowEditing && !isCurrentlyEditing}
              deleteDisabled={editBuffer.isAnyRowEditing && !isCurrentlyEditing}
              onChange={editBuffer.updateBuffer}
              onNameChange={editBuffer.updateBufferName}
              onRemove={() => handleRemoveEndpoint(endpointName)}
            />
          </Box>
        );
      })}
      <Button
        startIcon={<AddIcon />}
        onClick={handleAddEndpoint}
        variant="outlined"
        size="small"
        className={classes.addButton}
        disabled={disabled || editBuffer.isAnyRowEditing}
        color="primary"
      >
        Add Endpoint
      </Button>
    </Box>
  );
};
