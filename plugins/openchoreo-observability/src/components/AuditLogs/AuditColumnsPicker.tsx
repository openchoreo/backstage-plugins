import { useMemo } from 'react';
import { MultiSelectFilter } from '@openchoreo/backstage-design-system';
import { AUDIT_COLUMNS } from './types';

export interface AuditColumnsPickerProps {
  columns: string[];
  onChange: (columns: string[]) => void;
  disabled?: boolean;
}

const ALL_COLUMN_IDS = AUDIT_COLUMNS.map(column => column.id);

/**
 * Which columns the table shows.
 *
 * The four fixed columns — time, actor, action, resource — are offered as
 * disabled: a row without them does not identify the event it describes.
 */
export const AuditColumnsPicker = ({
  columns,
  onChange,
  disabled = false,
}: AuditColumnsPickerProps) => {
  const groups = useMemo(
    () => [
      {
        options: AUDIT_COLUMNS.map(column => ({
          value: column.id,
          label: column.label,
          disabled: column.fixed,
        })),
      },
    ],
    [],
  );

  const selected = useMemo(() => new Set(columns), [columns]);

  return (
    <MultiSelectFilter
      label="Columns"
      groups={groups}
      allValues={ALL_COLUMN_IDS}
      selected={selected}
      // The table itself shows which columns are on, so naming them on the
      // trigger too only makes its width jump as they are picked.
      showSelection={false}
      disabled={disabled}
      // Back into the table's own order, which is what the header renders.
      onChange={next => onChange(ALL_COLUMN_IDS.filter(id => next.has(id)))}
    />
  );
};
