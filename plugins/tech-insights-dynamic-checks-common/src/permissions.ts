import { createPermission } from '@backstage/plugin-permission-common';

/**
 * Read-only access to check management: every dynamic check (drafts
 * included), the fact collectors, and the catalog-wide score overview.
 *
 * @public
 */
export const dynamicCheckReadPermission = createPermission({
  name: 'tech-insights.dynamic-check.read',
  attributes: { action: 'read' },
});

/**
 * Everything else in check management: create, edit, delete, publish and
 * unpublish checks, dry-run them, and start a fact collector early.
 *
 * @public
 */
export const dynamicCheckManagePermission = createPermission({
  name: 'tech-insights.dynamic-check.manage',
  attributes: { action: 'update' },
});

/**
 * Every permission defined by the dynamic-checks module.
 *
 * @public
 */
export const dynamicChecksPermissions = [
  dynamicCheckReadPermission,
  dynamicCheckManagePermission,
];
