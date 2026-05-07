import * as React from 'react';
import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Box, Button, makeStyles } from '@material-ui/core';
import ChatOutlinedIcon from '@material-ui/icons/ChatOutlined';
import { useLatestFailedRun } from '@openchoreo/backstage-plugin-openchoreo-ci';
import {
  CHOREO_ANNOTATIONS,
  type ModelsBuild,
} from '@openchoreo/backstage-plugin-common';
import {
  useAssistantEnabled,
  useComponentEntityDetails,
} from '@openchoreo/backstage-plugin-react';
import { useAssistantDrawer } from '../AssistantContext/AssistantDrawerContext';
import { AssistantPromptLauncher } from '../AssistantPromptLauncher/AssistantPromptLauncher';

// React is referenced by JSX in the IDE's classic-runtime view; the
// workspace tsc uses the automatic runtime and treats this as unused.
// Silence both with a single statement that doesn't affect output.
void React;

const isFailedStatus = (status?: string) => {
  const lowered = (status ?? '').toLowerCase();
  return lowered.includes('fail') || lowered.includes('error');
};

const useStyles = makeStyles(theme => ({
  wrap: {
    position: 'fixed',
    right: theme.spacing(3),
    bottom: theme.spacing(3),
    zIndex: theme.zIndex.modal - 1,
  },
  button: {
    borderRadius: 999,
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
    textTransform: 'none',
    fontWeight: 600,
    boxShadow: theme.shadows[6],
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
    },
  },
  icon: {
    marginRight: theme.spacing(1),
    fontSize: 18,
  },
}));

/**
 * Two distinct UX modes on the component Build tab, decided by whether
 * the run currently in view (or the latest) is failed:
 *
 * - **Failed**: render the auto-pop popup (AssistantPromptLauncher) — same
 *   experience the user was getting before. Offers Continue previous /
 *   Start new when a chat for this run already exists in the session.
 * - **Healthy / no failure**: render an always-visible inline pill. Click
 *   opens the drawer with a build-overview prompt asking the agent to
 *   list recent runs and propose which to investigate.
 */
export const BuildPagePromptLauncher = () => {
  const classes = useStyles();
  const enabled = useAssistantEnabled();
  const { entity } = useEntity();
  const { getEntityDetails } = useComponentEntityDetails();
  const location = useLocation();
  const { openDrawer, hasConversation } = useAssistantDrawer();

  const componentName = entity.metadata.name;
  const namespaceFallback =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] ??
    entity.metadata.namespace ??
    'default';

  const runIdFromUrl = useMemo(() => {
    const match = location.pathname.match(/\/run\/([^/]+)$/);
    return match ? decodeURIComponent(match[1]) : undefined;
  }, [location.pathname]);

  const {
    latestRun,
    isFailed: latestFailed,
    builds,
    componentDetails,
  } = useLatestFailedRun();

  const targetRun: ModelsBuild | undefined = useMemo(() => {
    if (runIdFromUrl) {
      return builds.find(b => b.name === runIdFromUrl);
    }
    return latestFailed ? latestRun : undefined;
  }, [runIdFromUrl, builds, latestFailed, latestRun]);

  const targetIsFailed = !!targetRun?.name && isFailedStatus(targetRun.status);

  if (!enabled) return null;

  // ---- Failed mode: popup with Continue/Start new ----
  if (targetIsFailed && targetRun?.name) {
    const runName = targetRun.name;
    const isRunDetails = !!runIdFromUrl;
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

      openDrawer({
        initialMessage: isRunDetails
          ? `Why did this build fail?`
          : `Why did the latest build fail?`,
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
        },
        conversationKey,
        resetConversation,
      });
    };

    const renderMessage = () => {
      if (priorChat) {
        return (
          <>
            You already have a chat about <code>{runName}</code>. Continue where
            you left off, or start a fresh investigation?
          </>
        );
      }
      if (isRunDetails) {
        return (
          <>
            Build run <code>{runName}</code> failed. Want me to investigate the
            root cause?
          </>
        );
      }
      return (
        <>
          I noticed your latest build <code>{runName}</code> failed. Want me to
          investigate the root cause?
        </>
      );
    };
    const message = renderMessage();

    return (
      <AssistantPromptLauncher
        // Re-key on the run so navigating to a different failed run
        // re-mounts and re-pops the popup with that run's context.
        key={`${componentName}:${runName}`}
        message={message}
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
  }

  // ---- Healthy mode: inline pill ----
  // Open a BLANK drawer (no auto-seeded message) so the user can freely
  // ask whatever they want — "why did greeting-service-... fail?", "show
  // me the last 5 runs", "which builds failed today?", etc. Scope still
  // carries case_type=build_failure + namespace/project/component so the
  // agent has the right tool catalog and resource scope on the first
  // turn the user actually types.
  const handleClickOverview = async () => {
    let resolvedComponentName = componentName;
    let resolvedProjectName: string | undefined;
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
      scopeOverrides: {
        caseType: 'build_failure',
        namespace: resolvedNamespace,
        component: resolvedComponentName,
        ...(resolvedProjectName ? { project: resolvedProjectName } : {}),
      },
      conversationKey: `build_overview:${resolvedNamespace}:${resolvedComponentName}`,
    });
  };

  return (
    <Box className={classes.wrap}>
      <Button
        variant="contained"
        className={classes.button}
        onClick={() => {
          void handleClickOverview();
        }}
        aria-label="Open Perch to review recent build runs"
      >
        <ChatOutlinedIcon className={classes.icon} />
        Ask Perch
      </Button>
    </Box>
  );
};
