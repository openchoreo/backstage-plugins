import { homePlugin } from '@backstage/plugin-home';
import { createCardExtension } from '@backstage/plugin-home-react';
import { RecentlyVisitedCard } from './RecentlyVisitedCard';
import { RecentDeploymentsCard } from './RecentDeploymentsCard';
import {
  MyProjectsWidget,
  QuickActionsSection,
} from '@openchoreo/backstage-plugin';

export const RecentlyVisitedHomeWidget = homePlugin.provide(
  createCardExtension({
    name: 'RecentlyVisited',
    components: async () => ({ Content: RecentlyVisitedCard }),
    layout: {
      height: { minRows: 4 },
      width: { minColumns: 4 },
    },
  }),
);

export const MyProjectsHomeWidget = homePlugin.provide(
  createCardExtension({
    name: 'MyProjects',
    components: async () => ({ Content: MyProjectsWidget }),
    layout: {
      height: { minRows: 4 },
      width: { minColumns: 4 },
    },
  }),
);

export const QuickActionsHomeWidget = homePlugin.provide(
  createCardExtension({
    name: 'QuickActions',
    title: 'Quick Actions',
    components: async () => ({ Content: QuickActionsSection }),
    layout: {
      height: { minRows: 4 },
      width: { minColumns: 4 },
    },
  }),
);

export const RecentDeploymentsHomeWidget = homePlugin.provide(
  createCardExtension({
    name: 'RecentDeployments',
    components: async () => ({ Content: RecentDeploymentsCard }),
    layout: {
      height: { minRows: 4 },
      width: { minColumns: 4 },
    },
  }),
);
