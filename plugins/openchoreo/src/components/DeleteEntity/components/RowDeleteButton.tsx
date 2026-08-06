import { type MouseEvent } from 'react';
import { IconButton, Tooltip } from '@material-ui/core';
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';
import { Entity } from '@backstage/catalog-model';
import { useEntityDeletePermission } from '@openchoreo/backstage-plugin-react';
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
 * for rows already marked for deletion. Disabled (with an explanatory
 * tooltip) while the delete-permission check for the entity is loading or
 * denied. The click is stopped from bubbling so the row's navigate-on-click
 * doesn't fire.
 */
export const RowDeleteButton = ({ entity, onDelete }: RowDeleteButtonProps) => {
  const { canDelete, loading, deniedTooltip } =
    useEntityDeletePermission(entity);

  if (!isDeletableEntityKind(entity.kind) || isMarkedForDeletion(entity)) {
    return null;
  }

  const displayType = getEntityDisplayType(entity.kind);
  const displayName = entity.metadata.title || entity.metadata.name;
  const disabled = loading || !canDelete;

  const handleDelete = (event: MouseEvent) => {
    event.stopPropagation();
    onDelete(entity);
  };

  return (
    <Tooltip
      title={
        !loading && !canDelete
          ? deniedTooltip
          : `Delete ${displayType.toLowerCase()}`
      }
    >
      {/* span so the tooltip still fires while the button is disabled */}
      <span>
        <IconButton
          size="small"
          aria-label={`Delete ${displayName}`}
          onClick={handleDelete}
          disabled={disabled}
        >
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </span>
    </Tooltip>
  );
};
