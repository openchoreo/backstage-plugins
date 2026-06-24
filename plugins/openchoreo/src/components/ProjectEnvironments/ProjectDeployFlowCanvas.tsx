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
  MINI_SETUP_NODE_HEIGHT,
  MINI_SETUP_NODE_WIDTH,
  PipelineEdge,
  useHtmlGraphZoom,
} from '@openchoreo/backstage-plugin-react';
import type { ProjectEnvironment } from '../../api/OpenChoreoClientApi';
import { useProjectDeployFlowCanvasStyles } from './styles';
import { ProjectMiniEnvironmentNode } from './ProjectMiniEnvironmentNode';
import { ProjectSetupCard } from './ProjectSetupCard';

const SETUP_NODE_ID = '__setup__';

interface ProjectDeployFlowCanvasProps {
  environments: ProjectEnvironment[];
  selectedEnvName: string | null;
  selectedSetup: boolean;
  onSelectEnv: (envName: string | null) => void;
  onSelectSetup: () => void;
  onClearSelection: () => void;
}

/**
 * Pipeline DAG for a Project's environments. Lays out a leading Set up
 * tile plus compact env tiles via the shared dagre helpers from
 * @openchoreo/backstage-plugin-react and pans/zooms via a CSS-transform
 * layer. Click a tile to select it; the detail panel mounts the full
 * action surface separately.
 */
export const ProjectDeployFlowCanvas = ({
  environments,
  selectedEnvName,
  selectedSetup,
  onSelectEnv,
  onSelectSetup,
  onClearSelection,
}: ProjectDeployFlowCanvasProps) => {
  const classes = useProjectDeployFlowCanvasStyles();
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
      nodeSize: node => ({
        width: node.isSetup ? MINI_SETUP_NODE_WIDTH : MINI_ENV_NODE_WIDTH,
        height: node.isSetup ? MINI_SETUP_NODE_HEIGHT : MINI_ENV_NODE_HEIGHT,
      }),
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

  const setupNode = layout?.nodes.find(n => n.id === SETUP_NODE_ID);
  const envNodes = (layout?.nodes ?? []).filter(n => !n.isSetup);

  const envMap = useMemo(() => {
    const map = new Map<string, ProjectEnvironment>();
    for (const env of environments) map.set(env.name, env);
    return map;
  }, [environments]);

  const handleBackgroundClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClearSelection();
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
        data-testid="project-deploy-flow-canvas"
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
          {layout.edges.map(edge => (
            <PipelineEdge key={`${edge.from}-${edge.to}`} edge={edge} />
          ))}

          {setupNode && (
            <Box
              className={classes.setupNodeWrapper}
              role="button"
              tabIndex={0}
              aria-pressed={selectedSetup}
              aria-label="Select setup"
              onClick={onSelectSetup}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectSetup();
                }
              }}
              style={{
                left: setupNode.x,
                top: setupNode.y,
                width: setupNode.width,
                height: setupNode.height,
              }}
            >
              <ProjectSetupCard selected={selectedSetup} />
            </Box>
          )}

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
                <ProjectMiniEnvironmentNode
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
