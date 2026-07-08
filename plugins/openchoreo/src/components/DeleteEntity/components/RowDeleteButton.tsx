import { type MouseEvent } from 'react';
import { IconButton, Tooltip } from '@material-ui/core';
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';
import { Entity } from '@backstage/catalog-model';
import { isMarkedForDeletion } from '../utils';
import {
  getEntityDisplayType,
  isDeletableEntityKind,
} from '../hooks/deleteEntityDispatch';

export interface RowDeleteButtonProps {
  entity: Entity;
  /** Open the delete-confirmation dialog for this entity. */
  onDelete: (entity: Entity) => void;
}

/**
 * Per-row delete control shared by every listing (catalog "All ..." pages,
 * Project Contents, namespace projects/resources cards).
 *
 * Renders nothing for kinds the client can't delete (`api`, `user`, ...) and
 * for rows already marked for deletion. The click is stopped from bubbling so
 * the row's navigate-on-click doesn't fire.
 */
export const RowDeleteButton = ({ entity, onDelete }: RowDeleteButtonProps) => {
  if (!isDeletableEntityKind(entity.kind) || isMarkedForDeletion(entity)) {
    return null;
  }

  const displayType = getEntityDisplayType(entity.kind);
  const displayName = entity.metadata.title || entity.metadata.name;

  const handleDelete = (event: MouseEvent) => {
    event.stopPropagation();
    onDelete(entity);
  };

  return (
    <Tooltip title={`Delete ${displayType.toLowerCase()}`}>
      <IconButton
        size="small"
        aria-label={`Delete ${displayName}`}
        onClick={handleDelete}
      >
        <DeleteOutlineIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
};
