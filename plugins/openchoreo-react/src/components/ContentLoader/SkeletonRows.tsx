import { TableRow, TableCell } from '@material-ui/core';
import { Skeleton } from '@openchoreo/backstage-design-system';

export interface SkeletonRowsProps {
  /**
   * Number of placeholder rows to render.
   * @default 5
   */
  rows?: number;
  /** Number of columns per row (should match the table's column count). */
  cols: number;
}

/**
 * Skeleton table-body rows for the "header stays mounted, body swaps" loading
 * pattern. Replaces the copy-pasted `renderLoadingSkeletons()` helpers so every
 * table shimmers identically.
 *
 * Render inside a `<TableBody>` while first-loading; keep the surrounding
 * `<Table>`/`<TableHead>` mounted so the frame never pops.
 *
 * @example
 * ```tsx
 * <TableBody>
 *   {loading && <SkeletonRows rows={5} cols={5} />}
 *   {!loading && rows.map(...)}
 * </TableBody>
 * ```
 */
export const SkeletonRows = ({ rows = 5, cols }: SkeletonRowsProps) => (
  <>
    {Array.from({ length: rows }).map((_row, r) => (
      <TableRow key={`skeleton-row-${r}`}>
        {Array.from({ length: cols }).map((_col, c) => (
          <TableCell key={`skeleton-cell-${r}-${c}`}>
            <Skeleton variant="text" width="100%" />
          </TableCell>
        ))}
      </TableRow>
    ))}
  </>
);
