import type { ComponentType } from 'react';
import {
  MyProjectsWidgetPreview,
  QuickActionsSectionPreview,
} from '@openchoreo/backstage-plugin';
import { RecentDeploymentsPreview } from './RecentDeploymentsCard';
import { RecentlyVisitedPreview } from './RecentlyVisitedCard';

const MyProjectsPreview = () => <MyProjectsWidgetPreview disableCard />;
const QuickActionsPreview = () => <QuickActionsSectionPreview hideTitle />;

/**
 * Static previews for the "Add widget" gallery, keyed by the widget name
 * declared in homeExtensions.tsx. They show sample data and never call an
 * API. A widget with no entry here shows "No Preview Available".
 */
export const widgetPreviews: Record<string, ComponentType> = {
  OpenChoreoRecentlyVisited: RecentlyVisitedPreview,
  OpenChoreoMyProjects: MyProjectsPreview,
  OpenChoreoQuickActions: QuickActionsPreview,
  OpenChoreoRecentDeployments: RecentDeploymentsPreview,
};
