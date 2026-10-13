import { useMemo, useState } from 'react';
import { Box, Button, Tooltip, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { Alert } from '@material-ui/lab';
import DescriptionOutlinedIcon from '@material-ui/icons/DescriptionOutlined';
import EventNoteOutlinedIcon from '@material-ui/icons/EventNoteOutlined';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import ReplayIcon from '@material-ui/icons/Replay';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import {
  VerticalTabNav,
  type TabItemData,
} from '@openchoreo/backstage-design-system';
import {
  DetailPageLayout,
  formatRelativeTime,
  useOpenChoreoQuery,
  useReleaseBindingUpdatePermission,
} from '@openchoreo/backstage-plugin-react';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { readHookSpec } from '../../HookOverview/hookSpec';
import type { Environment } from '../hooks/useEnvironmentData';
import type { HookRow, HookRowState } from '../hooks/hookModel';
import { HookRunSteps } from './HookRunSteps';
import { RunPhaseChip, type RunPhaseTone } from './RunPhaseChip';
import { resolveHookInputs } from './hookInputs';

/** Catalog namespace cluster-scoped OpenChoreo entities live in. */
const CLUSTER_ENTITY_NAMESPACE = 'openchoreo-cluster';

const TONE: Record<HookRowState, RunPhaseTone> = {
  running: 'running',
  ok: 'ok',
  fail: 'fail',
  ignored: 'warn',
  skipped: 'muted',
  pending: 'muted',
};

type HookRunTab = 'logs' | 'events' | 'details';

const useStyles = makeStyles(theme => ({
  subtitle: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(1.5),
  },
  mono: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: '0.8rem',
  },
  banner: {
    marginBottom: theme.spacing(2),
  },
  facts: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: theme.spacing(2, 3),
    marginBottom: theme.spacing(3),
  },
  factLabel: {
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: theme.palette.text.secondary,
  },
  factValue: {
    overflowWrap: 'anywhere',
  },
  inputsTitle: {
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1),
  },
  inputRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1, 1.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
    fontSize: '0.8rem',
  },
  inputHead: {
    fontWeight: 600,
    backgroundColor: theme.palette.action.hover,
    borderRadius: 4,
    borderBottom: 'none',
  },
  notStarted: {
    padding: theme.spacing(2),
  },
}));

function duration(start?: string, end?: string): string {
  if (!start || !end) return '';
  const secs = Math.max(
    0,
    Math.round((Date.parse(end) - Date.parse(start)) / 1000),
  );
  return secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function policyText(hook: HookRow): string {
  if (hook.mode === 'Async') return 'Async · never blocks';
  return `Sync · on failure: ${hook.onFailure}`;
}

/** What went wrong (or right) in words, for the banner under the header. */
function bannerFor(
  hook: HookRow,
  environment: Environment,
): { severity: 'error' | 'warning' | 'info'; text: string } | null {
  const release = environment.deployment.releaseName ?? 'the release';
  const detail = hook.status?.message ? ` ${hook.status.message}.` : '';
  if (hook.state === 'fail' && hook.phase === 'preDeploy') {
    return {
      severity: 'error',
      text: `Deployment blocked. ${hook.name} failed, so ${release} was not deployed to ${environment.name}.${detail} Fix the cause and promote again, or retry the hook.`,
    };
  }
  if (hook.state === 'fail') {
    return {
      severity: 'error',
      text: `${hook.name} failed after ${release} was deployed to ${environment.name}; the deployment is marked degraded.${detail}`,
    };
  }
  if (hook.state === 'ignored') {
    return {
      severity: 'warning',
      text: `This hook failed, but ${
        hook.mode === 'Async'
          ? 'it runs asynchronously'
          : 'the binding ignores failures'
      }, so the release deployed to ${environment.name} anyway.${detail}`,
    };
  }
  if (hook.state === 'skipped') {
    return {
      severity: 'info',
      text: `Skipped for this component.${detail}`,
    };
  }
  return null;
}

interface HookRunPageProps {
  environment: Environment;
  hook: HookRow;
  /** OpenChoreo namespace of the component (and of its hook runs) */
  namespaceName: string;
  /** Catalog namespace the component's entities live in */
  catalogNamespace: string;
  onBack: () => void;
  /** Called after a retry was requested, to refresh the gate */
  onRetried: () => void;
}

/**
 * Full-page view of one deployment hook on an environment (deployment hooks,
 * alpha): its status, why it matters for the deploy, and the run's logs,
 * events and resolved inputs.
 */
export const HookRunPage = ({
  environment,
  hook,
  namespaceName,
  catalogNamespace,
  onBack,
  onRetried,
}: HookRunPageProps) => {
  const classes = useStyles();
  const client = useApi(openChoreoClientApiRef);
  const catalogApi = useApi(catalogApiRef);
  const [tab, setTab] = useState<HookRunTab>('logs');
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const status = hook.status;
  const runName = status?.workflowRunRef;
  const live = hook.state === 'running';
  const envResourceName = environment.resourceName ?? environment.name;
  const { canUpdate, deniedTooltip } =
    useReleaseBindingUpdatePermission(envResourceName);

  const hookEntityRef = useMemo(() => {
    if (!hook.hookRef?.name) return undefined;
    const cluster = hook.hookRef.kind === 'ClusterHook';
    return {
      kind: cluster ? 'clusterhook' : 'hook',
      namespace: cluster ? CLUSTER_ENTITY_NAMESPACE : catalogNamespace,
      name: hook.hookRef.name,
    };
  }, [hook.hookRef, catalogNamespace]);

  const { data: run } = useOpenChoreoQuery(
    ['hook-run', namespaceName, runName],
    () => client.fetchHookRun(namespaceName, runName!),
    { enabled: tab === 'details' && !!runName },
  );
  const { data: hookEntity } = useOpenChoreoQuery(
    [
      'hook-entity',
      hookEntityRef?.kind,
      hookEntityRef?.namespace,
      hookEntityRef?.name,
    ],
    () => catalogApi.getEntityByRef(hookEntityRef!),
    { enabled: tab === 'details' && !!hookEntityRef },
  );

  const canRetry =
    !!runName &&
    hook.mode === 'Sync' &&
    (hook.state === 'fail' || hook.state === 'ignored') &&
    !!environment.bindingName;

  const retry = async () => {
    if (!environment.bindingName) return;
    setRetrying(true);
    setRetryError(null);
    try {
      await client.retryReleaseBindingHook(
        namespaceName,
        environment.bindingName,
        hook.name,
        hook.phase,
      );
      onRetried();
    } catch (e) {
      setRetryError(e instanceof Error ? e.message : String(e));
    } finally {
      setRetrying(false);
    }
  };

  const tabs = useMemo<TabItemData[]>(
    () => [
      {
        id: 'logs',
        label: 'Logs',
        icon: <DescriptionOutlinedIcon fontSize="small" />,
      },
      {
        id: 'events',
        label: 'Events',
        icon: <EventNoteOutlinedIcon fontSize="small" />,
      },
      {
        id: 'details',
        label: 'Details',
        icon: <InfoOutlinedIcon fontSize="small" />,
      },
    ],
    [],
  );

  const phaseLabel =
    hook.phase === 'preDeploy' ? 'Before deploy' : 'After deploy';
  const took = duration(status?.startedAt, status?.finishedAt);
  let when = '';
  if (status?.finishedAt) {
    when = `Ran ${formatRelativeTime(status.finishedAt)}${
      took ? ` · ${took}` : ''
    }`;
  } else if (status?.startedAt) {
    when = `Started ${formatRelativeTime(status.startedAt)}`;
  }

  const subtitle = (
    <Box className={classes.subtitle}>
      <RunPhaseChip label={hook.stateText} tone={TONE[hook.state]} />
      <Typography variant="body2" color="textSecondary">
        {phaseLabel} hook · {environment.name}
        {environment.deployment.releaseName
          ? ` · ${environment.deployment.releaseName}`
          : ''}
      </Typography>
      {when && (
        <Typography variant="body2" color="textSecondary">
          {when}
        </Typography>
      )}
      {runName && <span className={classes.mono}>{runName}</span>}
    </Box>
  );

  const actions = canRetry ? (
    <Tooltip title={canUpdate ? '' : deniedTooltip ?? ''}>
      <span>
        <Button
          variant="contained"
          color="primary"
          startIcon={<ReplayIcon />}
          disabled={retrying || !canUpdate}
          onClick={retry}
        >
          {retrying ? 'Retrying…' : 'Retry hook'}
        </Button>
      </span>
    </Tooltip>
  ) : undefined;

  const banner = bannerFor(hook, environment);

  const renderDetails = () => {
    const facts: [string, string][] = [
      [
        'Hook',
        hook.hookRef
          ? `${hook.hookRef.kind ?? 'Hook'} / ${hook.hookRef.name}`
          : '—',
      ],
      ['Binding', `${hook.name} on ${environment.name}`],
      ['Policy', policyText(hook)],
      ['Workflow run', runName ?? 'not started'],
      ['Attempt', status?.attempt ? String(status.attempt) : '—'],
      ['Release', environment.deployment.releaseName ?? '—'],
    ];
    if (status?.reason) facts.push(['Reason', status.reason]);
    if (status?.message) facts.push(['Message', status.message]);
    const spec = hookEntity ? readHookSpec(hookEntity) : undefined;
    const inputs = runName
      ? resolveHookInputs(
          run?.parameters,
          spec?.parameters,
          hook.binding?.parameters,
        )
      : [];
    return (
      <Box>
        <Box className={classes.facts}>
          {facts.map(([k, v]) => (
            <Box key={k}>
              <Typography className={classes.factLabel}>{k}</Typography>
              <Typography variant="body2" className={classes.factValue}>
                {v}
              </Typography>
            </Box>
          ))}
        </Box>
        {inputs.length > 0 && (
          <Box data-testid="hook-run-inputs">
            <Typography className={classes.inputsTitle}>
              Inputs resolved for this release
            </Typography>
            <Box className={`${classes.inputRow} ${classes.inputHead}`}>
              <span>Name</span>
              <span>Value</span>
              <span>Source</span>
            </Box>
            {inputs.map(i => (
              <Box key={i.name} className={classes.inputRow}>
                <strong>{i.name}</strong>
                <span className={classes.mono}>{i.value}</span>
                <Typography variant="body2" color="textSecondary">
                  {i.source}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    );
  };

  const renderTab = () => {
    if (tab === 'details') return renderDetails();
    if (!runName) {
      return (
        <Typography
          variant="body2"
          color="textSecondary"
          className={classes.notStarted}
        >
          {hook.phase === 'preDeploy'
            ? `This hook runs before the next release deploys to ${environment.name}.`
            : `This hook starts after the release is ready in ${environment.name}.`}
        </Typography>
      );
    }
    return (
      <HookRunSteps
        key={`${runName}-${tab}`}
        namespaceName={namespaceName}
        runName={runName}
        view={tab}
        live={live}
      />
    );
  };

  return (
    <DetailPageLayout
      title={hook.name}
      subtitle={subtitle}
      onBack={onBack}
      actions={actions}
    >
      {banner && (
        <Alert
          severity={banner.severity}
          className={classes.banner}
          data-testid="hook-run-banner"
        >
          {banner.text}
        </Alert>
      )}
      {retryError && (
        <Alert severity="error" className={classes.banner}>
          Retry failed: {retryError}
        </Alert>
      )}
      <VerticalTabNav
        tabs={tabs}
        activeTabId={tab}
        onChange={id => setTab(id as HookRunTab)}
      >
        {renderTab()}
      </VerticalTabNav>
    </DetailPageLayout>
  );
};
