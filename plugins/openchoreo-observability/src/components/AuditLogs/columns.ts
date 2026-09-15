import { makeColumnStyle } from '@openchoreo/backstage-plugin-react';

/**
 * Flexbox column sizing shared by the audit table's header and its rows, so
 * the virtualized div rows line up with the header.
 *
 * Every basis allows shrink (`0 1 <basis>`) rather than fixing width: with
 * fifteen selectable columns a fixed set overflows, and a horizontal scrollbar
 * inside the virtualizer's own scroll container fights it. Columns narrow and
 * truncate instead, and `action` — omitted here — takes the remainder.
 */
export const getAuditColumnStyle = makeColumnStyle<string>({
  time: '0 1 132px',
  actor: '0 1 210px',
  resource: '0 1 170px',
  scope: '0 1 190px',
  result: '0 1 104px',
  surface: '0 1 84px',
  category: '0 1 116px',
  operation: '0 1 160px',
  environment: '0 1 160px',
  producer: '0 1 124px',
  request: '0 1 128px',
  ip: '0 1 112px',
  ua: '0 1 140px',
  http: '0 1 230px',
  // Sized to the copy button alone.
  actions: '0 0 30px',
});
