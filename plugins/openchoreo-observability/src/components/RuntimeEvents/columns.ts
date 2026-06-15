import { makeColumnStyle } from '@openchoreo/backstage-plugin-react';
import { EventEntryField } from './types';

/**
 * Flexbox column sizing shared by the events table header and each event row
 * so the (virtualized, div-based) rows line up with the header exactly as
 * the old `<table tableLayout="fixed">` did. Fixed-width columns keep their
 * former percentages; the Message column is omitted and fills the remainder.
 */
export const getColumnStyle = makeColumnStyle<EventEntryField>({
  [EventEntryField.Timestamp]: '0 0 15%',
  [EventEntryField.Type]: '0 0 10%',
  [EventEntryField.Reason]: '0 0 12%',
  [EventEntryField.Object]: '0 0 20%',
});
