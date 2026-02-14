import { MouseEvent, useState } from 'react';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import CircularProgress from '@material-ui/core/CircularProgress';
import { makeStyles } from '@material-ui/core/styles';
import {
  DependencyGraph,
  DependencyGraphTypes,
} from '@backstage/core-components';
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import { EntityNode } from '@backstage/plugin-catalog-graph';
import { FullScreen, useFullScreenHandle } from 'react-full-screen';
import { CustomGraphNode } from '../CustomGraphNode';
import { GraphLegend } from '../GraphLegend';
import { GraphControls } from '../GraphControls';
import { GraphMinimap } from '../GraphMinimap';
import { DefaultRenderLabel } from '../DefaultRenderLabel';
import { useAllEntitiesOfKinds } from '../../hooks/useAllEntitiesOfKinds';
import { useEntityGraphData } from '../../hooks/useEntityGraphData';
import { useGraphZoom } from '../../hooks/useGraphZoom';
import type { GraphViewDefinition } from '../../utils/platformOverviewConstants';

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
  topLeftContainer: {
    position: 'absolute',
    top: theme.spacing(2),
    left: theme.spacing(2),
    zIndex: 1,
  },
  topRightContainer: {
    position: 'absolute',
    top: theme.spacing(2),
    right: theme.spacing(2),
    zIndex: 1,
  },
  namespaceSelector: {
    minWidth: 180,
    backgroundColor: theme.palette.background.paper,
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
  },
  fullscreen: {
    backgroundColor: theme.palette.background.paper,
    display: 'flex',
    flex: 1,
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
    </>
  );
}

export type PlatformOverviewGraphViewProps = {
  view: GraphViewDefinition;
  namespace?: string;
  namespaces?: string[];
  onNamespaceChange?: (namespace: string) => void;
  onNodeClick?: (node: EntityNode, event: MouseEvent<unknown>) => void;
  direction?: DependencyGraphTypes.Direction;
  nodeMargin?: number;
  rankMargin?: number;
};

export function PlatformOverviewGraphView({
  view,
  namespace,
  namespaces,
  onNamespaceChange,
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
  } = useEntityGraphData(entityRefs, view, onNodeClick);

  const loading = refsLoading || graphLoading;
  const error = refsError || graphError;
  const hasNamespaceSelector = namespaces && onNamespaceChange;

  if (!hasNamespaceSelector) {
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

    if (entityCount === 0) {
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
    }
  }

  const showGraph = !loading && !error && entityCount > 0;

  const renderContent = () => {
    if (showGraph) {
      return (
        <Box className={classes.graph}>
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
        {hasNamespaceSelector && (
          <Box className={classes.topLeftContainer}>
            <FormControl
              variant="outlined"
              size="small"
              className={classes.namespaceSelector}
            >
              <InputLabel id="graph-namespace-label">Namespace</InputLabel>
              <Select
                labelId="graph-namespace-label"
                label="Namespace"
                value={namespace ?? ''}
                onChange={e => onNamespaceChange(e.target.value as string)}
              >
                {namespaces.map(ns => (
                  <MenuItem key={ns} value={ns}>
                    {ns}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}
        {showGraph && (
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
