import { makeColumnStyle } from '@openchoreo/backstage-plugin-react';
import { LogEntryField } from './types';

/**
 * Flexbox column sizing shared by the logs table header and each log row, so
 * the (virtualized, div-based) rows line up with the header exactly as the
 * old `<table tableLayout="fixed">` did. Fixed-width columns keep their
 * former percentages; the Log column is omitted from the map and falls
 * through to the "fill remainder" default.
 */
export const getColumnStyle = makeColumnStyle<LogEntryField>({
  [LogEntryField.Timestamp]: '0 0 15%',
  [LogEntryField.LogLevel]: '0 0 10%',
  [LogEntryField.ComponentName]: '0 0 15%',
});
