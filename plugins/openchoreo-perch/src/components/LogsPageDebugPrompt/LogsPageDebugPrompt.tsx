import { parseEntityRef } from '@backstage/catalog-model';
import { useEntity } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import {
  useAssistantEnabled,
  useComponentEntityDetails,
} from '@openchoreo/backstage-plugin-react';
import { Box, Button, makeStyles } from '@material-ui/core';
import ChatOutlinedIcon from '@material-ui/icons/ChatOutlined';
import { useSearchParams } from 'react-router-dom';
import type { ChatScope } from '../../api/AssistantAgentApi';
import { useAssistantDrawer } from '../AssistantContext/AssistantDrawerContext';

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
 * Inline "Ask Assistant" pill button on the component Logs tab. Click to
 * open the drawer with `caseType: 'logs_debug'` and the entity's scope
 * pre-populated so the agent can call query_component_logs (and rca-agent
 * tools when available) on the first turn.
 */
export const LogsPageDebugPrompt = () => {
  const classes = useStyles();
  const enabled = useAssistantEnabled();
  const { entity } = useEntity();
  const { getEntityDetails } = useComponentEntityDetails();
  const { openDrawer } = useAssistantDrawer();
  // The observability plugin keeps the selected env in the URL as ``?env=…``
  // (see useUrlFiltersForRuntimeLogs in plugins/openchoreo-observability).
  // Reading it here lets the launcher pre-populate ChatScope.environment so
  // the agent doesn't have to ask the user for what's already on screen.
  const [searchParams] = useSearchParams();

  if (!enabled) return null;

  const entityName = entity.metadata.name;
  const kind = (entity.kind ?? '').toLowerCase();
  const isComponent = kind === 'component';
  // ``env`` URL param — the observability plugin's RuntimeLogs page sets it
  // when the user picks an environment from the dropdown. Empty when no env
  // has been selected yet (rare; the page auto-selects the first one).
  const environment = searchParams.get('env') ?? undefined;

  const handleClick = async () => {
    const annotatedNamespace =
      entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];
    let namespace =
      annotatedNamespace ?? entity.metadata.namespace ?? 'default';
    let project = entityName;
    let component: string | undefined;

    if (isComponent) {
      component = entityName;
      try {
        const details = await getEntityDetails();
        namespace = details.namespaceName;
        project = details.projectName;
        component = details.componentName;
      } catch {
        // Fall back to entity metadata if relationship resolution fails.
      }
    } else if (!annotatedNamespace && entity.spec?.domain) {
      try {
        const domainRef = parseEntityRef(String(entity.spec.domain), {
          defaultKind: 'domain',
          defaultNamespace: 'default',
        });
        namespace = domainRef.name;
      } catch {
        // Ignore parse failures and fall back to the current namespace.
      }
    }

    const overrides: Partial<ChatScope> = {
      caseType: 'logs_debug',
      namespace,
      ...(component ? { component } : {}),
      ...(project ? { project } : {}),
      ...(environment ? { environment } : {}),
    };
    openDrawer({
      initialMessage: `What's going wrong in my recent logs?`,
      scopeOverrides: overrides,
      conversationKey:
        `logs_debug:${namespace}:${project ?? '-'}:` +
        `${component ?? '-'}:${environment ?? '-'}`,
    });
  };

  return (
    <Box className={classes.wrap}>
      <Button
        variant="contained"
        className={classes.button}
        disableElevation={false}
        onClick={() => {
          void handleClick();
        }}
        aria-label="Ask Perch about these logs"
      >
        <ChatOutlinedIcon className={classes.icon} />
        Ask Perch
      </Button>
    </Box>
  );
};
