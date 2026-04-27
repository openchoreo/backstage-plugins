import { useMemo } from 'react';
import { Box, Typography, Button, makeStyles } from '@material-ui/core';
import { alpha } from '@material-ui/core/styles';
import ArrowForwardIcon from '@material-ui/icons/ArrowForward';
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
  targets: { name: string; requiresApproval?: boolean }[];
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
}

const CHIP_NODE_WIDTH = 130;
const CHIP_NODE_HEIGHT = 32;

const useStyles = makeStyles(theme => ({
  pipelineFlow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  environmentChip: {
    padding: theme.spacing(0.5, 1.5),
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
}: PipelineFlowVisualizationProps) => {
  const classes = useStyles();

  const dagLayout = useMemo(() => {
    if (!promotionPaths || promotionPaths.length === 0) return null;
    if (!isNonLinear(promotionPaths)) return null;

    const inputs: PathPipelineInput[] = promotionPaths.map(p => ({
      source: p.source,
      targets: p.targets,
    }));
    const nodes = buildPathPipelineNodes(inputs);
    return computePipelineLayout(nodes, {
      direction: 'LR',
      defaultWidth: CHIP_NODE_WIDTH,
      defaultHeight: CHIP_NODE_HEIGHT,
      nodesep: 16,
      ranksep: 40,
      marginx: 8,
      marginy: 8,
    });
  }, [promotionPaths]);

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
      {dagLayout ? (
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
            {dagLayout.nodes.map(node => (
              <div
                key={node.id}
                className={classes.dagNode}
                style={{ left: node.x, top: node.y }}
              >
                {renderChip(node.id)}
              </div>
            ))}
          </div>
        </Box>
      ) : (
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
