import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { Box, useMediaQuery, useTheme } from '@material-ui/core';
import { useChoreoTokens } from '@openchoreo/backstage-design-system';
import {
  buildEnvPipelineNodes,
  computePipelineLayout,
  GraphControls,
  MINI_ENV_NODE_HEIGHT,
  MINI_ENV_NODE_WIDTH,
  PipelineEdge,
  useHtmlGraphZoom,
} from '@openchoreo/backstage-plugin-react';
import type { ResourceEnvironment } from '../../api/OpenChoreoClientApi';
import { useResourceDeployFlowCanvasStyles } from './styles';
import { ResourceMiniEnvironmentNode } from './ResourceMiniEnvironmentNode';

interface ResourceDeployFlowCanvasProps {
  environments: ResourceEnvironment[];
  selectedEnvName: string | null;
  onSelectEnv: (envName: string | null) => void;
}

/**
 * Pipeline DAG for a Resource's environments. Lays out compact env tiles
 * via the shared dagre helpers from @openchoreo/backstage-plugin-react and
 * pans/zooms via a CSS-transform layer. Click a tile to select it; the
 * detail panel mounts the full action surface separately.
 *
 * Mirrors Component's DeployFlowCanvas without the synthetic setup node
 * (resources have no workload-config concept) or incidents/drift overlays.
 */
export const ResourceDeployFlowCanvas = ({
  environments,
  selectedEnvName,
  onSelectEnv,
}: ResourceDeployFlowCanvasProps) => {
  const classes = useResourceDeployFlowCanvasStyles();
  const tokens = useChoreoTokens();
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));

  const direction = isNarrow ? 'TB' : 'LR';
  const layout = useMemo(() => {
    if (environments.length === 0) return null;
    const nodes = buildEnvPipelineNodes(environments);
    return computePipelineLayout(nodes, {
      direction,
      defaultWidth: MINI_ENV_NODE_WIDTH,
      defaultHeight: MINI_ENV_NODE_HEIGHT,
      nodesep: 24,
      ranksep: 60,
    });
  }, [environments, direction]);

  const contentWidth = layout?.width ?? 0;
  const contentHeight = layout?.height ?? 0;

  const {
    containerRef,
    contentRef,
    containerSize,
    zoomIn,
    zoomOut,
    fitToView,
    resetZoom,
  } = useHtmlGraphZoom({ contentWidth, contentHeight });

  // One-shot auto-fit after the container has been measured and dagre
  // has produced non-zero dims. Hidden until the fit lands to avoid a
  // flash of un-positioned tiles at the canvas origin.
  const didAutoFitRef = useRef(false);
  const [hasFitted, setHasFitted] = useState(false);
  useEffect(() => {
    if (didAutoFitRef.current) return;
    if (
      contentWidth === 0 ||
      contentHeight === 0 ||
      containerSize.width === 0 ||
      containerSize.height === 0
    ) {
      return;
    }
    didAutoFitRef.current = true;
    fitToView();
    setHasFitted(true);
  }, [
    contentWidth,
    contentHeight,
    containerSize.width,
    containerSize.height,
    fitToView,
  ]);

  // buildEnvPipelineNodes prepends a synthetic setup node we don't want
  // here. Filter it out and only render real env nodes; setup edges are
  // dropped naturally because we never render a setup tile.
  const envNodes = (layout?.nodes ?? []).filter(n => !n.isSetup);

  const envMap = useMemo(() => {
    const map = new Map<string, ResourceEnvironment>();
    for (const env of environments) map.set(env.name, env);
    return map;
  }, [environments]);

  const handleBackgroundClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onSelectEnv(null);
    }
  };

  if (!layout) {
    return null;
  }

  return (
    <Box
      className={classes.canvasFrame}
      style={{
        ['--canvas-dots' as string]: tokens.graph.canvasDotPattern,
      }}
    >
      {/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className={classes.canvasContainer}
        ref={containerRef}
        onClick={handleBackgroundClick}
      >
        <div
          className={classes.canvasContent}
          ref={contentRef}
          style={{
            width: contentWidth,
            height: contentHeight,
            opacity: hasFitted ? 1 : 0,
            transition: hasFitted ? 'opacity 120ms ease-in' : undefined,
          }}
          onClick={handleBackgroundClick}
        >
          {layout.edges
            .filter(edge => edge.from !== '__setup__' && edge.to !== '__setup__')
            .map(edge => (
              <PipelineEdge key={`${edge.from}-${edge.to}`} edge={edge} />
            ))}

          {envNodes.map(node => {
            const env = envMap.get(node.id);
            if (!env) return null;
            return (
              <Box
                key={node.id}
                className={classes.nodeWrapper}
                style={{
                  left: node.x,
                  top: node.y,
                  width: node.width,
                  height: node.height,
                }}
              >
                <ResourceMiniEnvironmentNode
                  env={env}
                  selected={selectedEnvName === env.name}
                  onSelect={() => onSelectEnv(env.name)}
                />
              </Box>
            );
          })}
        </div>
      </div>
      {/* eslint-enable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}

      <Box className={classes.controlsOverlay}>
        <GraphControls
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onFitToView={fitToView}
          onResetZoom={resetZoom}
        />
      </Box>
    </Box>
  );
};
