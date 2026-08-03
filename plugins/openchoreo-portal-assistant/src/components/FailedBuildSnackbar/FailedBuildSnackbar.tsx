import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useLatestFailedRun } from '@openchoreo/backstage-plugin-openchoreo-ci';
import {
  CHOREO_ANNOTATIONS,
  getRepositoryInfo,
} from '@openchoreo/backstage-plugin-common';
import {
  useAssistantEnabled,
  useComponentEntityDetails,
} from '@openchoreo/backstage-plugin-react';
import { useAssistantDrawer } from '../AssistantContext/AssistantDrawerContext';
import { AssistantPromptLauncher } from '../AssistantPromptLauncher/AssistantPromptLauncher';

const isFailedStatus = (status?: string) => {
  if (!status) return false;
  const s = status.toLowerCase();
  return s.includes('failed') || s.includes('error') || s.includes('errored');
};

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
  const { builds, latestRun, isFailed, componentDetails } =
    useLatestFailedRun();
  const { openDrawer, hasConversation } = useAssistantDrawer();
  const { pathname } = useLocation();

  // When the user is on a specific workflow-run sub-route
  // (``…/workflows/run/<run-name>``), the snackbar should target THAT
  // run rather than the latest one. Without this, a user clicking
  // into a historical failed run never sees the popup because the
  // component's latest run has since succeeded and ``isFailed`` is
  // false. The regex matches any path ending in ``/run/<name>``
  // (handles both component and project route shapes).
  const urlRun = useMemo(() => {
    const match = /\/run\/([^/?#]+)/.exec(pathname);
    if (!match) return undefined;
    const name = decodeURIComponent(match[1]);
    return builds.find(b => b.name === name);
  }, [pathname, builds]);

  // Target run priority: URL-named run (when on a run detail page) >
  // latest failed run. The URL-named path also fires for healthy runs
  // — but we still gate by status so we don't popup on a successful
  // run page.
  const targetRun = urlRun ?? latestRun;
  const targetIsFailed = urlRun ? isFailedStatus(urlRun.status) : isFailed;

  if (!enabled) return null;
  if (!targetIsFailed || !targetRun) return null;

  const componentName = entity.metadata.name;
  const namespaceFallback =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] ??
    entity.metadata.namespace ??
    'default';
  const runName = targetRun.name;
  const conversationKey = `build_failure:${componentName}:${runName}`;
  const priorChat = hasConversation(conversationKey);

  const open = async (resetConversation: boolean) => {
    let resolvedComponentName = componentName;
    let resolvedProjectName = targetRun.projectName;
    let resolvedNamespace = namespaceFallback;

    try {
      const details = await getEntityDetails();
      resolvedComponentName = details.componentName;
      resolvedProjectName = details.projectName;
      resolvedNamespace = details.namespaceName;
    } catch {
      // Fall back to entity metadata if relationship resolution fails.
    }

    const repoInfo = componentDetails
      ? getRepositoryInfo(componentDetails)
      : undefined;
    const repoUrl = repoInfo?.url;
    const componentPath = repoInfo?.path;

    openDrawer({
      initialMessage: `Why did the latest build fail?`,
      pin: {
        kind: 'workflow_run',
        namespace: resolvedNamespace,
        component: resolvedComponentName,
        project: resolvedProjectName,
        runName,
        runDisplay: runName,
        runStatus: targetRun.status,
        workflowName: componentDetails?.componentWorkflow?.name,
        workflowKind: componentDetails?.componentWorkflow?.kind,
        caseType: 'build_failure',
        repoUrl,
        componentPath,
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
      fabTooltip="Open Portal Assistant — failed build"
      fabAriaLabel="Open Portal Assistant for failed build"
    />
  );
};
