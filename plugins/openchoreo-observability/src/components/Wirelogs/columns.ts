import { makeColumnStyle } from '@openchoreo/backstage-plugin-react';

/**
 * Column key for the wirelogs table — keep in sync with the order of
 * `HEADER_COLUMNS` in WirelogsTable.tsx.
 */
export type WirelogsColumn =
  | 'time'
  | 'verdict'
  | 'type'
  | 'direction'
  | 'source'
  | 'destination'
  | 'summary';

/**
 * Flexbox column sizing shared by the wirelogs table header and each row, so
 * the (virtualized, div-based) rows line up with the header. Fixed-width
 * columns mirror what MUI's auto-layout used to produce for the original
 * `<Table>`; Summary is omitted from the map and fills the remainder.
 */
export const getColumnStyle = makeColumnStyle<WirelogsColumn>({
  time: '0 0 110px',
  verdict: '0 0 110px',
  type: '0 0 90px',
  direction: '0 0 110px',
  source: '0 0 220px',
  destination: '0 0 220px',
});
