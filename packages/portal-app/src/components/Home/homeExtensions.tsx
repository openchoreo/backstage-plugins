import { createFrontendModule } from '@backstage/frontend-plugin-api';
import {
  HomePageWidgetBlueprint,
  HomePageLayoutBlueprint,
} from '@backstage/plugin-home-react/alpha';

// Home page widgets + layout (new frontend system). Each widget's card
// extension owns the card frame and title, so the components render body-only
// to avoid duplicate titles. `params.name` is the widget's core.extensionName
// (used in the default layout); the `oc-` id prefix avoids clashing with the
// home plugin's built-in widgets.
const defaultWidgetLayout = {
  height: { minRows: 4 },
  width: { minColumns: 4 },
};

const recentlyVisitedWidget = HomePageWidgetBlueprint.make({
  name: 'oc-recently-visited',
  params: {
    name: 'OpenChoreoRecentlyVisited',
    title: 'Recently Visited',
    description: 'Pages and entities you visited recently.',
    layout: defaultWidgetLayout,
    components: async () => {
      const { RecentlyVisitedContent } = await import('./RecentlyVisitedCard');
      return { Content: RecentlyVisitedContent };
    },
  },
});

const overviewWidget = HomePageWidgetBlueprint.make({
  name: 'oc-overview',
  params: {
    name: 'OpenChoreoOverview',
    title: 'Overview',
    description:
      'Project, component, deployment, environment, API and resource counts at a glance.',
    layout: defaultWidgetLayout,
    components: async () => {
      const { OverviewWidget } = await import('@openchoreo/backstage-plugin');
      return { Content: () => <OverviewWidget disableCard /> };
    },
  },
});

const quickActionsWidget = HomePageWidgetBlueprint.make({
  name: 'oc-quick-actions',
  params: {
    name: 'OpenChoreoQuickActions',
    title: 'Quick Actions',
    description: 'Shortcuts to common tasks like creating a component.',
    // Fits both rows of tiles without scrolling.
    layout: {
      ...defaultWidgetLayout,
      height: { ...defaultWidgetLayout.height, defaultRows: 5 },
    },
    components: async () => {
      const { QuickActionsSection } = await import(
        '@openchoreo/backstage-plugin'
      );
      return { Content: () => <QuickActionsSection hideTitle /> };
    },
  },
});

const recentDeploymentsWidget = HomePageWidgetBlueprint.make({
  name: 'oc-recent-deployments',
  params: {
    name: 'OpenChoreoRecentDeployments',
    title: 'Recent Deployments',
    description: 'Latest releases across your components.',
    layout: defaultWidgetLayout,
    components: async () => {
      const { RecentDeploymentsContent } = await import(
        './RecentDeploymentsCard'
      );
      return { Content: RecentDeploymentsContent };
    },
  },
});

const homeLayout = HomePageLayoutBlueprint.make({
  params: {
    loader: async () => {
      const { HomePageLayout } = await import('./HomePageLayout');
      return HomePageLayout;
    },
  },
});

// Contributes the layout + widgets to `page:home`. The layout uses an
// internal input, so this must be a module of the `home` plugin.
export const homeModule = createFrontendModule({
  pluginId: 'home',
  extensions: [
    homeLayout,
    recentlyVisitedWidget,
    overviewWidget,
    quickActionsWidget,
    recentDeploymentsWidget,
  ],
});
