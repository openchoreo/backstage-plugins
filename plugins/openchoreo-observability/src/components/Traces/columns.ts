import { makeColumnStyle } from '@openchoreo/backstage-plugin-react';

/**
 * Column key for the traces table — keep in sync with the order of
 * `HEADER_COLUMNS` in TracesTable.tsx.
 */
export type TracesColumn =
  | 'traceName'
  | 'startTime'
  | 'endTime'
  | 'duration'
  | 'spanCount'
  | 'details';

/**
 * Flexbox column sizing shared by the traces table header and each row, so
 * the (virtualized, div-based) rows line up with the header exactly as the
 * old `<table tableLayout="fixed">` did. All columns are fixed-width; the
 * total (88%) leaves the same trailing whitespace MUI's table did.
 */
export const getColumnStyle = makeColumnStyle<TracesColumn>({
  traceName: '0 0 12%',
  startTime: '0 0 20%',
  endTime: '0 0 20%',
  duration: '0 0 12%',
  spanCount: '0 0 12%',
  details: '0 0 12%',
});
