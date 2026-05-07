import { useEntity } from '@backstage/plugin-catalog-react';
import { useLatestFailedRun } from '@openchoreo/backstage-plugin-openchoreo-ci';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import {
  useAssistantEnabled,
  useComponentEntityDetails,
} from '@openchoreo/backstage-plugin-react';
import { useAssistantDrawer } from '../AssistantContext/AssistantDrawerContext';
import { AssistantPromptLauncher } from '../AssistantPromptLauncher/AssistantPromptLauncher';

/**
 * FailedBuildSnackbar — chat-icon launcher with an auto-opened popup that
 * appears on a component overview page when the latest workflow run is in
 * a failed state. Click "Investigate" to open the assistant drawer with
 * the run pinned and an auto-seeded analysis prompt. Dismissing the popup
 * collapses it to the chat icon, which the user can re-click any time.
 *
 * If a chat for the same run already exists in the session, the popup
 * offers "Continue previous" + "Start new" instead of a single
 * Investigate button so the user controls history reset.
 */
export const FailedBuildSnackbar = () => {
  const enabled = useAssistantEnabled();
  const { entity } = useEntity();
  const { getEntityDetails } = useComponentEntityDetails();
  const { latestRun, isFailed, componentDetails } = useLatestFailedRun();
  const { openDrawer, hasConversation } = useAssistantDrawer();

  if (!enabled) return null;
  if (!isFailed || !latestRun) return null;

  const componentName = entity.metadata.name;
  const namespaceFallback =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] ??
    entity.metadata.namespace ??
    'default';
  const runName = latestRun.name;
  const conversationKey = `build_failure:${componentName}:${runName}`;
  const priorChat = hasConversation(conversationKey);

  const open = async (resetConversation: boolean) => {
    let resolvedComponentName = componentName;
    let resolvedProjectName = latestRun.projectName;
    let resolvedNamespace = namespaceFallback;

    try {
      const details = await getEntityDetails();
      resolvedComponentName = details.componentName;
      resolvedProjectName = details.projectName;
      resolvedNamespace = details.namespaceName;
    } catch {
      // Fall back to entity metadata if relationship resolution fails.
    }

    openDrawer({
      initialMessage: `Why did the latest build fail?`,
      pin: {
        kind: 'workflow_run',
        namespace: resolvedNamespace,
        component: resolvedComponentName,
        project: resolvedProjectName,
        runName,
        runDisplay: runName,
        runStatus: latestRun.status,
        workflowName: componentDetails?.componentWorkflow?.name,
        workflowKind: componentDetails?.componentWorkflow?.kind,
        caseType: 'build_failure',
      },
      // Shared with BuildPagePromptLauncher so opening from either
      // surface continues the same conversation.
      conversationKey,
      resetConversation,
    });
  };

  return (
    <AssistantPromptLauncher
      message={
        priorChat ? (
          <>
            You already have a chat about <code>{runName}</code>. Continue where
            you left off, or start a fresh investigation?
          </>
        ) : (
          <>
            I noticed your latest build <code>{runName}</code> failed. Want me
            to investigate the root cause?
          </>
        )
      }
      primaryActionLabel={priorChat ? 'Continue previous' : 'Investigate'}
      onPrimaryAction={() => {
        void open(false);
      }}
      secondaryActionLabel={priorChat ? 'Start new' : 'Not now'}
      onSecondaryAction={
        priorChat
          ? () => {
              void open(true);
            }
          : undefined
      }
      fabTooltip="Open Perch — failed build"
      fabAriaLabel="Open Perch for failed build"
    />
  );
};
