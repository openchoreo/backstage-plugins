/**
 * Permissions and entity-filter helpers shared by
 * `tech-insights-backend-module-dynamic-checks` and the scorecards frontend.
 *
 * @packageDocumentation
 */

export {
  dynamicCheckReadPermission,
  dynamicCheckManagePermission,
  dynamicChecksPermissions,
} from './permissions';
export { filterCoversKinds, isKindKey, kindsOfFilter } from './kinds';
