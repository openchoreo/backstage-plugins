import { createFrontendModule } from '@backstage/frontend-plugin-api';
import catalogPluginAlphaBase from '@backstage/plugin-catalog/alpha';
import { type EntityContentGroupDefinitions } from '@backstage/plugin-catalog-react/alpha';

// Backstage sorts the tab bar by key order and collapses tabs sharing a
// group key into a dropdown. Every OC tab uses a unique key here so tabs
// render flat. The six upstream defaults are retained in their vanilla
// relative order so non-OC entity pages are unaffected.
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
  deployment: { title: 'Deployment' },
  operation: { title: 'Operation' },
  observability: { title: 'Observability' },
};

// Mutually exclusive with `openChoreoEntityPageOverride` — both target the
// same extension. This one keeps vanilla NFS chrome; the other replaces it.
export const openChoreoEntityGroupsModule = createFrontendModule({
  pluginId: 'catalog',
  extensions: [
    catalogPluginAlphaBase.getExtension('page:catalog/entity').override({
      factory(originalFactory, { config }) {
        return originalFactory({
          config: {
            ...config,
            // OC groups first, adopter's app-config groups merge on top.
            groups: [OC_ENTITY_CONTENT_GROUPS as any, ...(config.groups ?? [])],
          },
        });
      },
    }),
  ],
});
