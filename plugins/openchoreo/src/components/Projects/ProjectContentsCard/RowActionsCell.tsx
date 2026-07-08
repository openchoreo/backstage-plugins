import { RowDeleteButton } from '../../DeleteEntity';
import { type ProjectContentItem } from '../hooks';

interface RowActionsCellProps {
  item: ProjectContentItem;
  /** Open the delete-confirmation dialog for this row's entity. */
  onDelete: (item: ProjectContentItem) => void;
}

/**
 * Per-row delete control for the Project Contents table. Both component and
 * resource rows are deletable; a row already marked for deletion shows
 * nothing (RowDeleteButton owns that gating and the click-bubbling stop).
 */
export const RowActionsCell = ({ item, onDelete }: RowActionsCellProps) => (
  <RowDeleteButton entity={item.entity} onDelete={() => onDelete(item)} />
);
