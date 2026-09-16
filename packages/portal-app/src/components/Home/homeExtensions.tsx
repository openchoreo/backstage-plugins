import { createFrontendModule } from '@backstage/frontend-plugin-api';
import {
  HomePageWidgetBlueprint,
  HomePageLayoutBlueprint,
} from '@backstage/plugin-home-react/alpha';

/**
 * Home page widgets and layout for the OpenChoreo portal, built on Backstage's
 * new frontend system. Each widget is a `HomePageWidgetBlueprint`; the card
 * frame and title come from the widget's card extension, so the loaded
 * components render body content only (no InfoCard/title of their own) to avoid
 * duplicated headers.
 *
 * The `name` param is the widget's `core.extensionName`, referenced from the
 * default layout in `HomePageLayout.tsx`. Extension names are prefixed to avoid
 * clashing with the home plugin's built-in widgets.
 */
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

const myProjectsWidget = HomePageWidgetBlueprint.make({
  name: 'oc-my-projects',
  params: {
    name: 'OpenChoreoMyProjects',
    title: 'My Projects',
    description: 'Project, component and deployment counts at a glance.',
    layout: defaultWidgetLayout,
    components: async () => {
      const { MyProjectsWidget } = await import('@openchoreo/backstage-plugin');
      return { Content: () => <MyProjectsWidget disableCard /> };
    },
  },
});

const quickActionsWidget = HomePageWidgetBlueprint.make({
  name: 'oc-quick-actions',
  params: {
    name: 'OpenChoreoQuickActions',
    title: 'Quick Actions',
    description: 'Shortcuts to common tasks like creating a component.',
    layout: defaultWidgetLayout,
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

/**
 * Contributes the custom home layout and widgets to the home plugin's
 * `page:home`. The layout attaches to an internal input, so this must be a
 * module of the `home` plugin.
 */
export const homeModule = createFrontendModule({
  pluginId: 'home',
  extensions: [
    homeLayout,
    recentlyVisitedWidget,
    myProjectsWidget,
    quickActionsWidget,
    recentDeploymentsWidget,
  ],
});
