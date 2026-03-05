import { MouseEvent, useEffect, useMemo, useState } from 'react';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import CircularProgress from '@material-ui/core/CircularProgress';
import { makeStyles } from '@material-ui/core/styles';
import {
  DependencyGraph,
  DependencyGraphTypes,
} from '@backstage/core-components';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { EntityNode } from '@backstage/plugin-catalog-graph';
import { FullScreen, useFullScreenHandle } from 'react-full-screen';
import { CustomGraphNode } from '../CustomGraphNode';
import { GraphSkeleton } from '../GraphSkeleton';
import { GraphLegend } from '../GraphLegend';
import { GraphControls } from '../GraphControls';
import { GraphMinimap } from '../GraphMinimap';
import { DefaultRenderLabel } from '../DefaultRenderLabel';
import { useAllEntitiesOfKinds } from '../../hooks/useAllEntitiesOfKinds';
import { useEntityGraphData } from '../../hooks/useEntityGraphData';
import { useGraphZoom } from '../../hooks/useGraphZoom';
import type { GraphViewDefinition } from '../../utils/platformOverviewConstants';
import { EDGE_COLOR } from '../../utils/graphUtils';

const useStyles = makeStyles(theme => ({
  fullscreenWrapper: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
  },
  graphWrapper: {
    position: 'relative',
    flex: 1,
    minHeight: 0,
    display: 'flex',
  },
  graph: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    backgroundImage:
      theme.palette.type === 'dark'
        ? 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)'
        : 'radial-gradient(circle, rgba(0,0,0,0.05) 1px, transparent 1px)',
    backgroundSize: '20px 20px',
    '& > div': {
      height: '100%',
    },
    '& > div > div': {
      height: '100%',
    },
    '& svg#dependency-graph': {
      height: '100% !important',
    },
    '& .BackstageDependencyGraphNode-node': {
      transition: 'none !important',
    },
    '& .BackstageDependencyGraphEdge-path': {
      transition: 'none !important',
      strokeWidth: '1.5 !important',
      stroke:
        theme.palette.type === 'dark'
          ? `${EDGE_COLOR}4D !important` // 30% opacity
          : `${EDGE_COLOR}59 !important`, // 35% opacity
      strokeLinecap: 'round',
      markerEnd: 'url(#custom-arrow) !important',
    },
    '& .BackstageDependencyGraphEdge-label': {
      transition: 'none !important',
    },
    '& .node-body': {
      transition: 'filter 200ms ease-in-out',
    },
  },
  centered: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  topRightContainer: {
    position: 'absolute',
    top: theme.spacing(2),
    right: theme.spacing(2),
    zIndex: 1,
    animation: '$fadeIn 300ms ease-in',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: theme.spacing(2),
    right: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: theme.spacing(1),
    zIndex: 1,
    animation: '$fadeIn 300ms ease-in',
  },
  fullscreen: {
    backgroundColor: theme.palette.background.paper,
    display: 'flex',
    flex: 1,
  },
  graphSkeleton: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    '& g': {
      animation: '$pulse 1.5s ease-in-out infinite',
    },
  },
  '@keyframes pulse': {
    '0%, 100%': { opacity: 0.4 },
    '50%': { opacity: 1 },
  },
  '@keyframes fadeIn': {
    from: { opacity: 0 },
    to: { opacity: 1 },
  },
}));

function GraphDefs() {
  return (
    <>
      <filter id="node-shadow">
        <feDropShadow
          dx="0"
          dy="1"
          stdDeviation="2"
          floodColor="rgba(0,0,0,0.10)"
        />
      </filter>
      <filter id="node-hover-glow">
        <feDropShadow
          dx="0"
          dy="2"
          stdDeviation="4"
          floodColor="rgba(0,0,0,0.18)"
        />
      </filter>
      <marker
        id="custom-arrow"
        viewBox="0 0 24 24"
        markerWidth="14"
        markerHeight="14"
        refX="16"
        refY="12"
        orient="auto"
        markerUnits="strokeWidth"
      >
        <path
          fill={`${EDGE_COLOR}80`}
          d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"
        />
      </marker>
    </>
  );
}

export type PlatformOverviewGraphViewProps = {
  view: GraphViewDefinition;
  namespace?: string;
  projects?: string[];
  allProjects?: string[];
  onNodeClick?: (node: EntityNode, event: MouseEvent<unknown>) => void;
  direction?: DependencyGraphTypes.Direction;
  nodeMargin?: number;
  rankMargin?: number;
};

export function PlatformOverviewGraphView({
  view,
  namespace,
  projects,
  allProjects,
  onNodeClick,
  direction = DependencyGraphTypes.Direction.LEFT_RIGHT,
  nodeMargin = 100,
  rankMargin = 100,
}: PlatformOverviewGraphViewProps) {
  const classes = useStyles();
  const fullscreenHandle = useFullScreenHandle();
  const [showLegend, setShowLegend] = useState(false);

  const {
    containerRef: graphWrapperRef,
    transform,
    viewBox,
    viewport,
    zoomIn,
    zoomOut,
    fitToView,
    panTo,
  } = useGraphZoom();

  const projectRefs = useMemo(
    () =>
      projects?.map(p =>
        stringifyEntityRef({
          kind: 'system',
          namespace: namespace ?? 'default',
          name: p,
        }),
      ),
    [projects, namespace],
  );

  const allProjectRefsComputed = useMemo(
    () =>
      allProjects?.map(p =>
        stringifyEntityRef({
          kind: 'system',
          namespace: namespace ?? 'default',
          name: p,
        }),
      ),
    [allProjects, namespace],
  );

  const {
    entityRefs,
    loading: refsLoading,
    error: refsError,
    entityCount,
  } = useAllEntitiesOfKinds(view.kinds, namespace);

  const {
    nodes,
    edges,
    loading: graphLoading,
    error: graphError,
  } = useEntityGraphData(
    entityRefs,
    view,
    onNodeClick,
    projectRefs,
    allProjectRefsComputed,
  );

  const loading = refsLoading || graphLoading;
  const error = refsError || graphError;
  const showGraph = !loading && !error && entityCount > 0;

  // Stable key to detect graph content changes (e.g. project filter)
  const graphContentKey = useMemo(
    () =>
      nodes
        .map(n => n.id)
        .sort()
        .join(','),
    [nodes],
  );

  // Hide the graph until the dagre layout settles to prevent the
  // initial viewBox animation (0 0 0 0 → actual dimensions).
  const [graphReady, setGraphReady] = useState(false);
  useEffect(() => {
    if (!showGraph) {
      setGraphReady(false);
      return undefined;
    }
    setGraphReady(false);
    const timer = setTimeout(() => setGraphReady(true), 400);
    return () => clearTimeout(timer);
  }, [showGraph, graphContentKey]);

  const renderContent = () => {
    if (showGraph) {
      return (
        <>
          {!graphReady && <GraphSkeleton className={classes.graphSkeleton} />}
          <Box
            className={classes.graph}
            style={{ opacity: graphReady ? 1 : 0 }}
          >
            <DependencyGraph
              nodes={nodes}
              edges={edges}
              renderNode={CustomGraphNode}
              renderLabel={DefaultRenderLabel}
              defs={<GraphDefs />}
              direction={direction}
              nodeMargin={nodeMargin}
              rankMargin={rankMargin}
              paddingX={20}
              paddingY={40}
              zoom="enabled"
              showArrowHeads
              curve="curveMonotoneX"
              fit="contain"
              labelPosition={DependencyGraphTypes.LabelPosition.RIGHT}
              labelOffset={8}
              allowFullscreen={false}
            />
          </Box>
        </>
      );
    }
    if (loading) {
      return (
        <Box className={classes.centered}>
          <CircularProgress />
          <Typography variant="body2" color="textSecondary">
            Loading entities...
          </Typography>
        </Box>
      );
    }
    if (error) {
      return (
        <Box className={classes.centered}>
          <Typography variant="h6" color="error">
            Failed to load entities
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {error.message}
          </Typography>
        </Box>
      );
    }
    return (
      <Box className={classes.centered}>
        <Typography variant="h6" color="textSecondary">
          No entities found
        </Typography>
        <Typography variant="body2" color="textSecondary">
          {view.description}
        </Typography>
      </Box>
    );
  };

  return (
    <FullScreen
      handle={fullscreenHandle}
      className={
        fullscreenHandle.active
          ? `${classes.fullscreenWrapper} ${classes.fullscreen}`
          : classes.fullscreenWrapper
      }
    >
      <div ref={graphWrapperRef} className={classes.graphWrapper}>
        {renderContent()}
        {showGraph && graphReady && (
          <>
            <Box className={classes.topRightContainer}>
              <GraphMinimap
                transform={transform}
                viewBox={viewBox}
                viewport={viewport}
                onPan={panTo}
              />
            </Box>
            <Box className={classes.controlsContainer}>
              {showLegend && <GraphLegend kinds={view.kinds} />}
              <GraphControls
                onZoomIn={zoomIn}
                onZoomOut={zoomOut}
                onFitToView={fitToView}
                onToggleFullscreen={
                  fullscreenHandle.active
                    ? fullscreenHandle.exit
                    : fullscreenHandle.enter
                }
                isFullscreen={fullscreenHandle.active}
                onToggleLegend={() => setShowLegend(prev => !prev)}
                showLegend={showLegend}
              />
            </Box>
          </>
        )}
      </div>
    </FullScreen>
  );
}
