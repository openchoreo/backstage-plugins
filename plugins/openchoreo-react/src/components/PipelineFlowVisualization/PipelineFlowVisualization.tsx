import { Fragment, useMemo, useState } from 'react';
import { Box, Typography, Button, makeStyles } from '@material-ui/core';
import { alpha } from '@material-ui/core/styles';
import ArrowForwardIcon from '@material-ui/icons/ArrowForward';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import clsx from 'clsx';
import { Link } from '@backstage/core-components';

import {
  buildPathPipelineNodes,
  computePipelineLayout,
  PipelineEdge,
  type PathPipelineInput,
} from './dag';

/**
 * Canonical promotion-path input for the visualization. Source is a
 * plain env name; targets carry an optional `requiresApproval` flag.
 * Callers normalize whatever shape they have (catalog spec or BFF
 * response) into this before passing in.
 */
export interface PipelinePromotionPath {
  source: string;
  targets: {
    name: string;
    requiresApproval?: boolean;
  }[];
}

/**
 * What a hook does to the deployment:
 * - `blocks`: Sync pre-deploy with onFailure=Block — a failure stops the deploy
 * - `alerts`: Sync post-deploy with onFailure=Alert — a failure degrades Ready
 * - `waits`: Sync with onFailure=Ignore — waited for, failure is ignored
 * - `background`: Async — started and not waited for
 */
export type PipelineHookEffect = 'blocks' | 'alerts' | 'waits' | 'background';

/** A hook binding of an environment (deployment hooks, alpha). */
export interface PipelineEnvironmentHook {
  key: string;
  /** Binding name */
  name: string;
  phase: 'pre' | 'post';
  effect: PipelineHookEffect;
  /** Catalog URL of the Hook / ClusterHook entity */
  to?: string;
}

export interface PipelineFlowVisualizationProps {
  /** Ordered env names — used by the chip-strip fallback layout. */
  environments: string[];
  /** Structured promotion paths — when present and non-linear, renders a DAG. */
  promotionPaths?: PipelinePromotionPath[];
  highlightedEnvironment?: string;
  pipelineEntityRef?: string;
  pipelineName?: string;
  showPipelineLink?: boolean;
  environmentNamespace?: string;
  /**
   * Deployment hooks (alpha) keyed by environment name. Hooks belong to the
   * environment and run for every deployment into it, so they are drawn in
   * "Before deploy" / "After deploy" lanes around the environment rather than
   * on the arrows between environments.
   */
  environmentHooks?: Record<string, PipelineEnvironmentHook[]>;
}

const CHIP_NODE_WIDTH = 130;
const CHIP_NODE_HEIGHT = 32;
// Height of one hook pill plus its gap, for spacing hook stacks in the DAG.
const HOOK_PILL_STEP = 22;
// Height of the "N hooks" toggle under an environment chip.
const HOOK_TOGGLE_HEIGHT = 20;
// Space between an environment's pre-deploy and post-deploy pills.
const HOOK_PHASE_GAP = 6;

/** Hover text: what the hook does to the deployment. */
const EFFECT_DESCRIPTIONS: Record<PipelineHookEffect, string> = {
  blocks: 'waits for it; a failure blocks the deployment',
  alerts: 'waits for it; a failure marks the deployment degraded',
  waits: 'waits for it; a failure is ignored',
  background: 'runs in the background; the deployment does not wait',
};

const useStyles = makeStyles(theme => ({
  pipelineFlow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  environmentChip: {
    padding: theme.spacing(0.5, 1.5),
    textAlign: 'center',
    borderRadius: theme.spacing(1),
    fontSize: theme.typography.body2.fontSize,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  currentEnvironment: {
    backgroundColor: theme.palette.success.main,
    color: theme.palette.common.white,
    border: `2px solid ${theme.palette.success.dark}`,
  },
  otherEnvironment: {
    backgroundColor: alpha(theme.palette.success.main, 0.1),
    color: theme.palette.success.dark,
    border: `1.5px solid ${theme.palette.success.main}`,
  },
  arrow: {
    color: theme.palette.text.secondary,
    fontSize: '1rem',
  },
  linkButton: {
    marginTop: theme.spacing(1),
    textTransform: 'none',
  },
  dagScroll: {
    overflowX: 'auto',
    overflowY: 'hidden',
    width: '100%',
  },
  dagCanvas: {
    position: 'relative',
  },
  dagNode: {
    position: 'absolute',
    width: CHIP_NODE_WIDTH,
    height: CHIP_NODE_HEIGHT,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLink: {
    textDecoration: 'none',
    display: 'block',
    width: '100%',
    textAlign: 'center',
  },
  hookGroup: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 2,
  },
  hookGroupAbsolute: {
    position: 'absolute',
    zIndex: 1,
    width: CHIP_NODE_WIDTH,
  },
  hookPill: {
    display: 'block',
    boxSizing: 'border-box',
    width: '100%',
    padding: '1px 6px',
    textAlign: 'center',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    borderRadius: theme.spacing(0.5),
    fontSize: '0.7rem',
    fontWeight: 500,
    lineHeight: '16px',
    whiteSpace: 'nowrap',
    textDecoration: 'none',
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    color: theme.palette.text.primary,
  },
  hookPillBlocks: {
    border: `1px solid ${theme.palette.warning.main}`,
    color: theme.palette.warning.dark,
  },
  hookPillAlerts: {
    border: `1px solid ${theme.palette.error.light}`,
    color: theme.palette.error.dark,
  },
  hookPillBackground: {
    border: `1px solid ${theme.palette.info.main}`,
    color: theme.palette.info.dark,
  },
  lanes: {
    display: 'grid',
    alignItems: 'center',
    columnGap: theme.spacing(1),
    rowGap: theme.spacing(0.5),
    width: 'max-content',
  },
  // Pills and the environment chip stretch to the column's width, so each
  // hook reads as belonging to the environment card it sits on.
  laneCell: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    minWidth: CHIP_NODE_WIDTH,
  },
  laneCellEnv: {
    alignSelf: 'start',
  },
  // An open environment's hooks hang below its card, so opening or closing
  // one never moves the cards or arrows.
  hookStackBelow: {
    marginTop: 4,
  },
  hookStackAfterPre: {
    marginTop: HOOK_PHASE_GAP,
  },
  laneArrow: {
    alignSelf: 'start',
    marginTop: 8,
  },
  hookToggle: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    width: '100%',
    height: HOOK_TOGGLE_HEIGHT,
    padding: 0,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    font: 'inherit',
    fontSize: '0.7rem',
    fontWeight: 500,
    color: theme.palette.text.secondary,
    '&:hover': {
      color: theme.palette.primary.main,
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      borderRadius: 4,
    },
  },
  hookToggleIcon: {
    fontSize: '0.9rem',
  },
  hookToggleAbsolute: {
    position: 'absolute',
    width: CHIP_NODE_WIDTH,
  },
}));

const capitalizeFirst = (str: string) =>
  str.charAt(0).toUpperCase() + str.slice(1);

const entityRefToUrl = (
  entityRef: string,
  fallbackNamespace = 'default',
): string => {
  const colonIndex = entityRef.indexOf(':');
  if (colonIndex === -1) return `/catalog/${fallbackNamespace}/${entityRef}`;

  const kind = entityRef.substring(0, colonIndex);
  const rest = entityRef.substring(colonIndex + 1);
  const slashIndex = rest.indexOf('/');

  if (slashIndex === -1) {
    return `/catalog/${fallbackNamespace}/${kind}/${rest}`;
  }

  const namespace = rest.substring(0, slashIndex);
  const name = rest.substring(slashIndex + 1);
  return `/catalog/${namespace}/${kind}/${name}`;
};

/**
 * A graph is non-linear (worth rendering as a DAG) when any node has
 * more than one outgoing edge OR more than one incoming edge.
 */
function isNonLinear(paths: PipelinePromotionPath[]): boolean {
  const outDegree = new Map<string, number>();
  const inDegree = new Map<string, number>();
  for (const path of paths) {
    if (!path.source) continue;
    outDegree.set(
      path.source,
      (outDegree.get(path.source) ?? 0) + path.targets.length,
    );
    for (const target of path.targets) {
      if (!target.name) continue;
      inDegree.set(target.name, (inDegree.get(target.name) ?? 0) + 1);
    }
  }
  for (const v of outDegree.values()) if (v > 1) return true;
  for (const v of inDegree.values()) if (v > 1) return true;
  return false;
}

export const PipelineFlowVisualization = ({
  environments,
  promotionPaths,
  highlightedEnvironment,
  pipelineEntityRef,
  showPipelineLink = false,
  environmentNamespace = 'default',
  environmentHooks,
}: PipelineFlowVisualizationProps) => {
  const classes = useStyles();

  const hooksFor = (envName: string, phase: 'pre' | 'post') =>
    (environmentHooks?.[envName] ?? []).filter(h => h.phase === phase);
  // Only this pipeline's environments count; the map may cover the namespace.
  const hasHooks = environments.some(
    env => (environmentHooks?.[env]?.length ?? 0) > 0,
  );
  // Hooks start collapsed; each environment's toggle shows them.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const toggle = (env: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(env)) next.delete(env);
      else next.add(env);
      return next;
    });
  const isOpen = (env: string) => expanded.has(env);

  const dagLayout = useMemo(() => {
    if (!promotionPaths || promotionPaths.length === 0) return null;
    if (!isNonLinear(promotionPaths)) return null;

    // An open environment's hooks hang below its node (pre-deploy, then
    // post-deploy), so leave room below for the tallest open stack.
    const tallest = environments
      .filter(env => expanded.has(env))
      .reduce((max, env) => {
        const hooks = environmentHooks?.[env] ?? [];
        const pre = hooks.filter(h => h.phase === 'pre').length;
        const post = hooks.filter(h => h.phase === 'post').length;
        const gap = pre > 0 && post > 0 ? HOOK_PHASE_GAP : 0;
        return Math.max(max, (pre + post) * HOOK_PILL_STEP + gap);
      }, 0);
    const stackSpace = tallest > 0 ? tallest + 8 : 0;
    const hookSpace = (hasHooks ? HOOK_TOGGLE_HEIGHT : 0) + stackSpace;

    const inputs: PathPipelineInput[] = promotionPaths.map(p => ({
      source: p.source,
      targets: p.targets,
    }));
    const nodes = buildPathPipelineNodes(inputs);
    return {
      hookSpace,
      ...computePipelineLayout(nodes, {
        direction: 'LR',
        defaultWidth: CHIP_NODE_WIDTH,
        defaultHeight: CHIP_NODE_HEIGHT,
        nodesep: 16 + hookSpace,
        ranksep: hasHooks ? 60 : 40,
        marginx: 8,
        marginy: 8 + hookSpace,
      }),
    };
  }, [promotionPaths, environmentHooks, hasHooks, environments, expanded]);

  const renderHookPill = (hook: PipelineEnvironmentHook) => {
    const pill = (
      <span
        className={clsx(
          classes.hookPill,
          hook.effect === 'blocks' && classes.hookPillBlocks,
          hook.effect === 'alerts' && classes.hookPillAlerts,
          hook.effect === 'background' && classes.hookPillBackground,
        )}
        title={`${hook.phase === 'pre' ? 'Before' : 'After'} deploy: ${
          hook.name
        } — ${EFFECT_DESCRIPTIONS[hook.effect]}`}
        data-testid={`hook-pill-${hook.key}`}
      >
        {hook.name}
      </span>
    );
    return hook.to ? (
      <Link
        key={hook.key}
        to={hook.to}
        style={{ textDecoration: 'none', display: 'block' }}
      >
        {pill}
      </Link>
    ) : (
      <span key={hook.key}>{pill}</span>
    );
  };

  const renderHookStack = (
    envName: string,
    phase: 'pre' | 'post',
    className?: string,
    style?: object,
  ) => {
    const hooks = hooksFor(envName, phase);
    if (hooks.length === 0) return null;
    return (
      <Box
        className={clsx(classes.hookGroup, className)}
        style={style}
        data-testid={`hooks-${phase}-${envName}`}
      >
        {hooks.map(renderHookPill)}
      </Box>
    );
  };

  const renderHooksToggle = (
    envName: string,
    className?: string,
    style?: object,
  ) => {
    const count = environmentHooks?.[envName]?.length ?? 0;
    if (count === 0) return null;
    const open = isOpen(envName);
    return (
      <button
        type="button"
        className={clsx(classes.hookToggle, className)}
        style={style}
        aria-expanded={open}
        aria-label={`${open ? 'Hide' : 'Show'} ${count} deployment hook${
          count === 1 ? '' : 's'
        } of ${envName}`}
        data-testid={`hooks-toggle-${envName}`}
        onClick={() => toggle(envName)}
      >
        {count} hook{count === 1 ? '' : 's'}
        {open ? (
          <ExpandLessIcon className={classes.hookToggleIcon} />
        ) : (
          <ExpandMoreIcon className={classes.hookToggleIcon} />
        )}
      </button>
    );
  };

  const renderChip = (envName: string) => {
    const isHighlighted =
      highlightedEnvironment?.toLowerCase() === envName.toLowerCase();
    const chip = (
      <Typography
        className={clsx(
          classes.environmentChip,
          isHighlighted ? classes.currentEnvironment : classes.otherEnvironment,
        )}
      >
        {capitalizeFirst(envName)}
      </Typography>
    );
    if (isHighlighted) return chip;
    return (
      <Link
        to={`/catalog/${environmentNamespace}/environment/${envName.toLowerCase()}`}
        className={classes.chipLink}
      >
        {chip}
      </Link>
    );
  };

  return (
    <>
      {dagLayout && (
        <Box
          className={classes.dagScroll}
          style={{ height: dagLayout.height + 8 }}
        >
          <div
            className={classes.dagCanvas}
            style={{ width: dagLayout.width, height: dagLayout.height }}
          >
            {dagLayout.edges.map(edge => (
              <PipelineEdge key={`${edge.from}-${edge.to}`} edge={edge} />
            ))}
            {dagLayout.nodes.map(node => {
              const preCount = hooksFor(node.id, 'pre').length;
              const below = node.y + CHIP_NODE_HEIGHT + HOOK_TOGGLE_HEIGHT + 4;
              return (
                <Fragment key={node.id}>
                  <div
                    className={classes.dagNode}
                    style={{ left: node.x, top: node.y }}
                  >
                    {renderChip(node.id)}
                  </div>
                  {renderHooksToggle(node.id, classes.hookToggleAbsolute, {
                    left: node.x,
                    top: node.y + CHIP_NODE_HEIGHT + 2,
                  })}
                  {isOpen(node.id) &&
                    renderHookStack(node.id, 'pre', classes.hookGroupAbsolute, {
                      left: node.x,
                      top: below,
                    })}
                  {isOpen(node.id) &&
                    renderHookStack(
                      node.id,
                      'post',
                      classes.hookGroupAbsolute,
                      {
                        left: node.x,
                        top:
                          below +
                          preCount * HOOK_PILL_STEP +
                          (preCount > 0 ? HOOK_PHASE_GAP : 0),
                      },
                    )}
                </Fragment>
              );
            })}
          </div>
        </Box>
      )}
      {!dagLayout && hasHooks && (
        <Box className={classes.dagScroll}>
          <Box
            className={classes.lanes}
            style={{
              gridTemplateColumns: [
                ...environments.flatMap((_, i) =>
                  i < environments.length - 1
                    ? ['max-content', 'max-content']
                    : ['max-content'],
                ),
              ].join(' '),
            }}
            data-testid="pipeline-hook-lanes"
          >
            {environments.map((env, index) => (
              <Fragment key={env}>
                <Box className={clsx(classes.laneCell, classes.laneCellEnv)}>
                  {renderChip(env)}
                  {renderHooksToggle(env)}
                  {isOpen(env) &&
                    renderHookStack(env, 'pre', classes.hookStackBelow)}
                  {isOpen(env) &&
                    renderHookStack(
                      env,
                      'post',
                      hooksFor(env, 'pre').length > 0
                        ? classes.hookStackAfterPre
                        : classes.hookStackBelow,
                    )}
                </Box>
                {index < environments.length - 1 && (
                  <ArrowForwardIcon
                    className={clsx(classes.arrow, classes.laneArrow)}
                  />
                )}
              </Fragment>
            ))}
          </Box>
        </Box>
      )}
      {!dagLayout && !hasHooks && (
        <Box className={classes.pipelineFlow}>
          {environments.map((env, index) => (
            <Box
              key={env}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {renderChip(env)}
              {index < environments.length - 1 && (
                <ArrowForwardIcon className={classes.arrow} />
              )}
            </Box>
          ))}
        </Box>
      )}

      {showPipelineLink && pipelineEntityRef && (
        <Link
          to={entityRefToUrl(pipelineEntityRef, environmentNamespace)}
          style={{ textDecoration: 'none' }}
        >
          <Button
            variant="text"
            color="primary"
            size="small"
            className={classes.linkButton}
          >
            View Pipeline Details
          </Button>
        </Link>
      )}
    </>
  );
};
