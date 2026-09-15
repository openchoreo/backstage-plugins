import { createFrontendModule } from '@backstage/frontend-plugin-api';
import catalogPluginAlphaBase from '@backstage/plugin-catalog/alpha';
import { type EntityContentGroupDefinitions } from '@backstage/plugin-catalog-react/alpha';

/**
 * Canonical OpenChoreo tab order. Backstage sorts the tab bar by this
 * map's key order — earlier keys render first — and collapses tabs whose
 * `group:` value matches the same key AND has >=2 tabs into a dropdown.
 * Every OC tab uses a unique `group:` value here, so we never trigger the
 * collapse and every tab renders flat.
 *
 * The six upstream defaults (overview, documentation, development,
 * deployment, operation, observability) are retained in their vanilla
 * relative order so third-party plugins whose tabs use those names
 * (Kubernetes, Jenkins, GitHub Actions, GitLab, upstream api-docs,
 * techdocs) still resolve — a non-OC entity page renders exactly as it
 * would under vanilla NFS, because our OC-specific slots stay empty for
 * those pages and position values only matter relatively.
 */
const OC_ENTITY_CONTENT_GROUPS: EntityContentGroupDefinitions = {
  overview: { title: 'Overview' },
  documentation: { title: 'Documentation' },
  definition: { title: 'Definition' },
  development: { title: 'Development' },
  build: { title: 'Build' },
  deploy: { title: 'Deploy' },
  'cell-diagram': { title: 'Cell Diagram' },
  diagram: { title: 'Diagram' },
  logs: { title: 'Logs' },
  events: { title: 'Events' },
  metrics: { title: 'Metrics' },
  alerts: { title: 'Alerts' },
  wirelogs: { title: 'Wirelogs' },
  traces: { title: 'Traces' },
  incidents: { title: 'Incidents' },
  'rca-reports': { title: 'RCA Reports' },
  'cost-analysis': { title: 'Cost Analysis' },
  // Retained defaults, kept in vanilla's relative order.
  deployment: { title: 'Deployment' },
  operation: { title: 'Operation' },
  observability: { title: 'Observability' },
};

/**
 * Overrides `page:catalog/entity`'s `groupDefinitions` so OC-managed
 * entities get the canonical OpenChoreo tab order without triggering the
 * vanilla NFS dropdown-collapse behavior. Non-OC entity pages
 * (Users, Groups, catalog-imported components without OC annotations,
 * everything else) render exactly as they would without this module, since
 * the six upstream default group names are retained here in their vanilla
 * relative order.
 *
 * Adopters opt in by adding this feature to `createApp({ features })`
 * alongside `openchoreoPluginAlpha`:
 *
 * ```ts
 * import openchoreoPluginAlpha, {
 *   openChoreoEntityGroupsModule,
 * } from '@openchoreo/backstage-plugin/alpha';
 *
 * createApp({ features: [openchoreoPluginAlpha, openChoreoEntityGroupsModule] });
 * ```
 *
 * Mutually exclusive with {@link openChoreoEntityPageOverride}: both
 * target the same upstream extension. Install one or the other, not both.
 * {@link openChoreoEntityPageOverride} additionally replaces the entire
 * page chrome with `OpenChoreoEntityLayout` (portal-app's legacy look);
 * this module keeps the vanilla NFS chrome and only tweaks group ordering.
 */
export const openChoreoEntityGroupsModule = createFrontendModule({
  pluginId: 'catalog',
  extensions: [
    catalogPluginAlphaBase.getExtension('page:catalog/entity').override({
      factory(originalFactory, { config }) {
        // The extension's `groups` config is an array of maps that get
        // merged into `groupDefinitions` at render time (see
        // `plugin-catalog/dist/alpha/pages.esm.js`). We inject our OC map
        // as the (only) entry, which fully replaces the six vanilla
        // defaults — but we retained those default names above so the
        // effect on non-OC entity pages is zero.
        return originalFactory({
          // Cast: EntityContentGroupDefinitions accepts `icon` as
          // ReactElement, but the extension's config schema constrains it
          // to string. Our entries only set `title`, so the shapes are
          // compatible in practice.
          config: {
            ...config,
            groups: [OC_ENTITY_CONTENT_GROUPS as any],
          },
        });
      },
    }),
  ],
});
