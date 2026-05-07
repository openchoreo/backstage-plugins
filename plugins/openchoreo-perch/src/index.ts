// Plugin shell + API factory (kept as a Backstage plugin so the
// AssistantAgentClient is registered idiomatically via apiRef).
export { openchoreoPerchPlugin } from './plugin';

// API client + types
export {
  assistantAgentApiRef,
  AssistantAgentClient,
  type AssistantAgentApi,
  type ChatCaseType,
  type ChatMessage,
  type ChatScope,
  type ExecuteResult,
  type ProposedAction,
  type StreamEvent,
} from './api/AssistantAgentApi';

// Drawer context (provider + consumer hook)
export {
  AssistantDrawerProvider,
  useAssistantDrawer,
  type OpenAssistantOptions,
  type PinnedContext,
} from './components/AssistantContext/AssistantDrawerContext';

// UI surfaces — plain React components, mounted by packages/app at fixed
// points in the entity page tree. Not wrapped in createComponentExtension
// because the lazy-loading overhead doesn't pay off at this size; if a
// future component grows large enough to warrant code-splitting, wrap
// that one specifically.
//
// Note: the always-on global FAB was deliberately removed — Perch is
// surfaced by the contextual launchers below (build page, logs page,
// failed-run snackbar) on the pages where it can do useful work.
// Mounting a global FAB invited the user into a chat that had no scope
// and degraded the UX on pages where Perch can't act. If we ever need a
// FAB again, prefer scoping it to specific routes rather than a global
// "available everywhere" mount.
export { FailedBuildSnackbar } from './components/FailedBuildSnackbar/FailedBuildSnackbar';
export { BuildPagePromptLauncher } from './components/BuildPagePromptLauncher/BuildPagePromptLauncher';
export { LogsPageDebugPrompt } from './components/LogsPageDebugPrompt/LogsPageDebugPrompt';
