import { makeColumnStyle } from '@openchoreo/backstage-plugin-react';
import { PlatformLogField } from './types';

/**
 * Flexbox column sizing shared by the platform logs table header and each row, so the
 * virtualized div-based rows line up with the header. The Log column is omitted and
 * falls through to the "fill remainder" default.
 */
export const getPlatformColumnStyle = makeColumnStyle<PlatformLogField>({
  [PlatformLogField.Timestamp]: '0 0 14%',
  [PlatformLogField.LogLevel]: '0 0 7%',
  [PlatformLogField.Cluster]: '0 0 10%',
  [PlatformLogField.Namespace]: '0 0 14%',
  [PlatformLogField.Pod]: '0 0 16%',
  [PlatformLogField.Container]: '0 0 10%',
});
