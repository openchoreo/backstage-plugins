import type { FC } from 'react';
import { Box, Button } from '@material-ui/core';
import CheckIcon from '@material-ui/icons/Check';
import CloseIcon from '@material-ui/icons/Close';
import DeleteIcon from '@material-ui/icons/Delete';
import EditIcon from '@material-ui/icons/Edit';
import { useStyles } from './styles';

export interface EditRowActionsProps {
  /** Whether the row is currently in edit mode. */
  isEditing: boolean;
  /** Begin editing this row (shown read-only). */
  onEdit: () => void;
  /** Commit the buffered edits ("Save", shown while editing). */
  onApply: () => void;
  /** Discard the buffered edits ("Cancel", shown while editing). */
  onCancel: () => void;
  /** Remove the row entirely ("Delete", shown in both modes). */
  onRemove: () => void;
  /** Disable every action. */
  disabled?: boolean;
  /** Disable only Edit (e.g. another row is currently editing). */
  editDisabled?: boolean;
  /** Disable only Delete (e.g. another row is currently editing). */
  deleteDisabled?: boolean;
  /** Disable only Save (e.g. validation is failing). */
  applyDisabled?: boolean;
  /**
   * Singular noun used to build accessible labels, e.g. "endpoint" yields
   * "Remove endpoint". @default "item"
   */
  itemLabel?: string;
  /** Hide the Cancel button while editing. @default false */
  hideCancel?: boolean;
  /** Hide the Delete button entirely (e.g. inherited rows that can't be deleted). @default false */
  hideDelete?: boolean;
  /** Text for the read-only edit button, e.g. "Override". @default "Edit" */
  editLabel?: string;
  /** Variant for the read-only edit button. @default "outlined" */
  editVariant?: 'outlined' | 'contained';
}

/**
 * EditRowActions — the action footer for an inline-editable list row.
 *
 * Renders a full-width bar at the bottom of an editor card. The destructive
 * Delete action sits on the left; the primary actions sit on the right. In edit
 * mode it shows labeled Save (contained) and Cancel (outlined) buttons so the
 * commit/discard choice is unmistakable; read-only it shows an Edit button.
 *
 * @example
 * ```tsx
 * <EditRowActions
 *   isEditing={isEditing}
 *   itemLabel="endpoint"
 *   onEdit={onEdit}
 *   onApply={onApply}
 *   onCancel={onCancel}
 *   onRemove={onRemove}
 *   applyDisabled={!isValid}
 * />
 * ```
 */
export const EditRowActions: FC<EditRowActionsProps> = ({
  isEditing,
  onEdit,
  onApply,
  onCancel,
  onRemove,
  disabled = false,
  editDisabled = false,
  deleteDisabled = false,
  applyDisabled = false,
  itemLabel = 'item',
  hideCancel = false,
  hideDelete = false,
  editLabel = 'Edit',
  editVariant = 'outlined',
}) => {
  const classes = useStyles();

  return (
    <Box className={classes.footer}>
      {!hideDelete ? (
        <Button
          onClick={onRemove}
          variant="text"
          color="secondary"
          size="small"
          startIcon={<DeleteIcon />}
          disabled={disabled || (!isEditing && deleteDisabled)}
          aria-label={`Remove ${itemLabel}`}
        >
          Delete
        </Button>
      ) : (
        <span />
      )}
      <Box className={classes.primaryActions}>
        {isEditing ? (
          <>
            {!hideCancel && (
              <Button
                onClick={onCancel}
                variant="outlined"
                size="small"
                startIcon={<CloseIcon />}
                disabled={disabled}
                aria-label="Cancel editing"
              >
                Cancel
              </Button>
            )}
            <Button
              onClick={onApply}
              variant="contained"
              color="primary"
              size="small"
              startIcon={<CheckIcon />}
              disabled={disabled || applyDisabled}
              aria-label="Save changes"
            >
              Save
            </Button>
          </>
        ) : (
          <Button
            onClick={onEdit}
            variant={editVariant}
            color={editVariant === 'contained' ? 'primary' : undefined}
            size="small"
            startIcon={<EditIcon />}
            disabled={disabled || editDisabled}
            aria-label={`${editLabel} ${itemLabel}`}
          >
            {editLabel}
          </Button>
        )}
      </Box>
    </Box>
  );
};
