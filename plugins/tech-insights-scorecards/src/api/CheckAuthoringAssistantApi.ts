import type { ComponentType, ReactNode } from 'react';
import { createApiRef } from '@backstage/core-plugin-api';
import type { DynamicCheck, FactSchema } from './types';

/**
 * An AI assistant that helps write checks, contributed with
 * `CheckAuthoringAssistantBlueprint`. The check list's "Create check" menu
 * offers `NewCheckLauncher` and the edit page and dialog show `LaunchButton`.
 *
 * @alpha
 */
export interface CheckAuthoringAssistant {
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

/**
 * Collects the `CheckAuthoringAssistantBlueprint` extensions; `assistant` is
 * the first one, or undefined when none is installed and nothing renders.
 * Internal to this plugin: other plugins contribute through the blueprint.
 */
export interface CheckAuthoringAssistantsApi {
  assistant?: CheckAuthoringAssistant;
}

export const checkAuthoringAssistantsApiRef =
  createApiRef<CheckAuthoringAssistantsApi>({
    id: 'plugin.tech-insights-scorecards.check-authoring-assistants',
  });
