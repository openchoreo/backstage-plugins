import { type MouseEvent } from 'react';
import { IconButton, Tooltip } from '@material-ui/core';
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';
import { isMarkedForDeletion } from '../../DeleteEntity';
import { type ProjectContentItem } from '../hooks';

interface RowActionsCellProps {
  item: ProjectContentItem;
  /** Open the delete-confirmation dialog for this component. */
  onDelete: (item: ProjectContentItem) => void;
}

/**
 * Per-row delete control for the Project Contents table.
 *
 * Only components are deletable from the listing — Resource rows have no
 * client-side delete, and a row already marked for deletion shows nothing.
 * The click is stopped from bubbling so the row's navigate-on-click doesn't
 * fire.
 */
export const RowActionsCell = ({ item, onDelete }: RowActionsCellProps) => {
  if (item.kind !== 'component' || isMarkedForDeletion(item.entity)) {
    return null;
  }

  const handleDelete = (event: MouseEvent) => {
    event.stopPropagation();
    onDelete(item);
  };

  return (
    <Tooltip title="Delete component">
      <IconButton
        size="small"
        aria-label={`Delete ${item.displayName}`}
        onClick={handleDelete}
      >
        <DeleteOutlineIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
};
