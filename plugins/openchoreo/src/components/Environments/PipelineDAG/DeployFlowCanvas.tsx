import { useMemo, useState, useCallback, type FC } from 'react';
import { Box, useMediaQuery, useTheme } from '@material-ui/core';
import {
  buildEnvPipelineNodes,
  computePipelineLayout,
  GraphControls,
  HtmlGraphMinimap,
  MINI_ENV_NODE_HEIGHT,
  MINI_ENV_NODE_WIDTH,
  MINI_SETUP_NODE_HEIGHT,
  MINI_SETUP_NODE_WIDTH,
  PipelineEdge,
  useHtmlGraphZoom,
  type HtmlGraphMinimapNode,
} from '@openchoreo/backstage-plugin-react';
import { useDeployFlowCanvasStyles } from '../styles';
import { MiniEnvironmentNode } from '../components/MiniEnvironmentNode';
import { SetupCard } from '../components/SetupCard';
import type { ActionTrackers, Environment } from '../types';

const SETUP_NODE_ID = '__setup__';

export interface DeployFlowCanvasProps {
  environments: Environment[];
  loading: boolean;
  isWorkloadEditorSupported: boolean;
  selectedEnvName: string | null;
  refreshingEnvName: (envName: string) => boolean;
  isAlreadyPromoted: (sourceEnv: Environment, targetEnvName: string) => boolean;
  actionTrackers: ActionTrackers;
  onSelectEnv: (envName: string | null) => void;
  onConfigureWorkload: () => void;
  onRefreshEnv: (envName: string) => void;
  onOpenOverrides: (env: Environment) => void;
  onOpenReleaseDetails: (env: Environment) => void;
  onPromote: (env: Environment, targetEnvName: string) => Promise<void>;
  onSuspend: (env: Environment) => Promise<void>;
  onRedeploy: (env: Environment) => Promise<void>;
}

/**
 * Left pane of the deploy split view. Lays out compact env nodes via
 * dagre, applies a CSS-transform pan/zoom layer, and overlays a minimap
 * and zoom controls. The whole canvas always renders nodes at native
 * size; users zoom/pan to navigate.
 */
export const DeployFlowCanvas: FC<DeployFlowCanvasProps> = ({
  environments,
  loading,
  isWorkloadEditorSupported,
  selectedEnvName,
  refreshingEnvName,
  isAlreadyPromoted,
  actionTrackers,
  onSelectEnv,
  onConfigureWorkload,
  onRefreshEnv,
  onOpenOverrides,
  onOpenReleaseDetails,
  onPromote,
  onSuspend,
  onRedeploy,
}) => {
  const classes = useDeployFlowCanvasStyles();
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));
  const [isFullscreen, setIsFullscreen] = useState(false);

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
    viewBox,
    viewport,
    zoomIn,
    zoomOut,
    fitToView,
    panTo,
  } = useHtmlGraphZoom({
    contentWidth,
    contentHeight,
  });

  const setupNode = layout?.nodes.find(n => n.id === SETUP_NODE_ID);
  const envNodes = layout?.nodes.filter(n => !n.isSetup) ?? [];

  const envMap = useMemo(() => {
    const map = new Map<string, Environment>();
    for (const env of environments) map.set(env.name, env);
    return map;
  }, [environments]);

  const minimapNodes: HtmlGraphMinimapNode[] = useMemo(
    () =>
      (layout?.nodes ?? []).map(node => ({
        id: node.id,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        highlighted: node.id === selectedEnvName,
      })),
    [layout, selectedEnvName],
  );

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  if (!layout) {
    return null;
  }

  return (
    <Box className={classes.canvasFrame}>
      <div className={classes.canvasContainer} ref={containerRef}>
        <div
          className={classes.canvasContent}
          ref={contentRef}
          style={{ width: contentWidth, height: contentHeight }}
        >
          {layout.edges.map(edge => (
            <PipelineEdge key={`${edge.from}-${edge.to}`} edge={edge} />
          ))}

          {setupNode && (
            <Box
              className={classes.setupNodeWrapper}
              style={{
                left: setupNode.x,
                top: setupNode.y,
                width: setupNode.width,
                height: setupNode.height,
              }}
            >
              <SetupCard
                compact
                loading={loading}
                environmentsExist={environments.length > 0}
                isWorkloadEditorSupported={isWorkloadEditorSupported}
                onConfigureWorkload={onConfigureWorkload}
              />
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
                <MiniEnvironmentNode
                  environment={env}
                  selected={selectedEnvName === env.name}
                  isRefreshing={refreshingEnvName(env.name)}
                  isAlreadyPromoted={target => isAlreadyPromoted(env, target)}
                  actionTrackers={actionTrackers}
                  onSelect={() => onSelectEnv(env.name)}
                  onRefresh={() => onRefreshEnv(env.name)}
                  onOpenOverrides={() => onOpenOverrides(env)}
                  onOpenReleaseDetails={() => onOpenReleaseDetails(env)}
                  onPromote={target => onPromote(env, target)}
                  onSuspend={() => onSuspend(env)}
                  onRedeploy={() => onRedeploy(env)}
                />
              </Box>
            );
          })}
        </div>
      </div>

      <Box className={classes.minimapOverlay}>
        <HtmlGraphMinimap
          viewBox={viewBox}
          viewport={viewport}
          nodes={minimapNodes}
          onPan={panTo}
        />
      </Box>
      <Box className={classes.controlsOverlay}>
        <GraphControls
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onFitToView={fitToView}
          onToggleFullscreen={toggleFullscreen}
          isFullscreen={isFullscreen}
        />
      </Box>
    </Box>
  );
};
