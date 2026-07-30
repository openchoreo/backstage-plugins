import { HomePageStarredEntities } from '@backstage/plugin-home';
import { HomePageSearchBar } from '@backstage/plugin-search';
import {
  MyProjectsWidget,
  QuickActionsSection,
} from '@openchoreo/backstage-plugin';
import { useNamespacePermission } from '@openchoreo/backstage-plugin-react';
import { HomePagePlatformDetailsCard } from '@openchoreo/backstage-plugin-platform-engineer-core';
import { RecentlyVisitedCard } from '../RecentlyVisitedCard';
import { RecentDeploymentsCard } from '../RecentDeploymentsCard';
import { useStyles } from '../styles';
import { HomeCardDefinition } from './types';

const SearchCard = () => {
  const classes = useStyles();
  return (
    <HomePageSearchBar
      InputProps={{
        classes: {
          root: classes.searchBarInput,
          notchedOutline: classes.searchBarOutline,
        },
      }}
      placeholder="Search"
    />
  );
};

/** Platform details are only shown to users who can read namespaces. */
const usePlatformDetailsVisibility = (): boolean => {
  const { canView } = useNamespacePermission();
  return canView;
};

/**
 * All predefined home page cards, keyed by id. Named layout configs (see
 * ./configs.ts) reference cards by id, and the upcoming Backstage
 * "edit home page" card picker is expected to select from this same set.
 */
export const HOME_CARD_REGISTRY: Record<string, HomeCardDefinition> = {
  search: {
    id: 'search',
    title: 'Search',
    description: 'Search across the catalog, docs and APIs.',
    component: SearchCard,
  },
  'my-projects': {
    id: 'my-projects',
    title: 'My Projects',
    description: 'Workspace counts at a glance.',
    component: MyProjectsWidget,
  },
  'quick-actions': {
    id: 'quick-actions',
    title: 'Quick Actions',
    description: 'Shortcuts to common tasks like creating a component.',
    component: QuickActionsSection,
  },
  'recent-deployments': {
    id: 'recent-deployments',
    title: 'Recent Deployments',
    description: 'Latest releases across your components.',
    component: RecentDeploymentsCard,
  },
  'starred-entities': {
    id: 'starred-entities',
    title: 'Starred Entities',
    description: 'Your starred catalog entities.',
    component: HomePageStarredEntities,
  },
  'recently-visited': {
    id: 'recently-visited',
    title: 'Recently Visited',
    description: 'Pages and entities you visited recently.',
    component: RecentlyVisitedCard,
  },
  'platform-details': {
    id: 'platform-details',
    title: 'Platform Details',
    description: 'Data planes, workflow planes and observability planes.',
    component: HomePagePlatformDetailsCard,
    useVisibility: usePlatformDetailsVisibility,
  },
};
