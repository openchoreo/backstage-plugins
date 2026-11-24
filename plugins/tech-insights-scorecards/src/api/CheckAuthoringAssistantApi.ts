import type { ComponentType, ReactNode } from 'react';
import { createApiRef } from '@backstage/core-plugin-api';
import type { DynamicCheck, FactSchema } from './types';

/**
 * Optional slot for an AI assistant that helps write checks. When a host app
 * provides it, the check list's "Create check" menu offers `NewCheckLauncher`
 * and the edit page and dialog show `LaunchButton`; otherwise nothing is
 * rendered. Lets an assistant plugin plug in without this plugin depending on
 * it.
 */
export interface CheckAuthoringAssistantApi {
  /**
   * Rendered when editing a check; receives the fact schemas already loaded
   * and the check being edited. `onChecksChanged` is called after the
   * assistant saves a check.
   */
  LaunchButton: ComponentType<{
    factSchemas: FactSchema[];
    check: DynamicCheck;
    onChecksChanged?: () => void;
  }>;
  /**
   * Optional source of the "Generate with AI" option in the "Create check"
   * menu. Calls `children` with a function that opens the assistant on a new
   * check, or with undefined when the assistant is turned off.
   * `onChecksChanged` is called after the assistant saves a check.
   */
  NewCheckLauncher?: ComponentType<{
    factSchemas: FactSchema[];
    onChecksChanged?: () => void;
    children: (openAssistant?: () => void) => ReactNode;
  }>;
}

export const checkAuthoringAssistantApiRef =
  createApiRef<CheckAuthoringAssistantApi>({
    id: 'plugin.tech-insights-scorecards.check-authoring-assistant',
  });
