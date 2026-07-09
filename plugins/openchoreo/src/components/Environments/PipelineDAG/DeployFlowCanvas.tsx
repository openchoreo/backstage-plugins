import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
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
import { useDeployFlowCanvasStyles } from '../styles';
import { MiniEnvironmentNode } from '../components/MiniEnvironmentNode';
import { SetupCard } from '../components/SetupCard';
import { useEnvironmentsContext } from '../EnvironmentsContext';
import { makeIsTargetProjectBlocked } from '../utils/projectDeployment';
import type { ActionTrackers, Environment } from '../types';

const SETUP_NODE_ID = '__setup__';

export interface DeployFlowCanvasProps {
  environments: Environment[];
  loading: boolean;
  isWorkloadEditorSupported: boolean;
  selectedEnvName: string | null;
  selectedSetup: boolean;
  refreshingEnvName: (envName: string) => boolean;
  isAlreadyPromoted: (sourceEnv: Environment, targetEnvName: string) => boolean;
  actionTrackers: ActionTrackers;
  /** Per-env active-incident summary, keyed by env name. */
  incidentsSummaries?: Map<string, { activeCount: number; loading: boolean }>;
  onSelectEnv: (envName: string | null) => void;
  onSelectSetup: () => void;
  onClearSelection: () => void;
  onConfigureWorkload: () => void;
  onRefreshEnv: (envName: string) => void;
  onOpenOverrides: (env: Environment) => void;
  onOpenReleaseDetails: (env: Environment) => void;
  onPromote: (env: Environment, targetEnvName: string) => Promise<void>;
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
  selectedSetup,
  refreshingEnvName,
  isAlreadyPromoted,
  actionTrackers,
  incidentsSummaries,
  onSelectEnv,
  onSelectSetup,
  onClearSelection,
  onConfigureWorkload,
  onRefreshEnv,
  onOpenOverrides,
  onOpenReleaseDetails,
  onPromote,
}) => {
  const classes = useDeployFlowCanvasStyles();
  const tokens = useChoreoTokens();
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));
  const { componentError } = useEnvironmentsContext();

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
  } = useHtmlGraphZoom({
    contentWidth,
    contentHeight,
  });

  // Fit-to-view once after the container has been measured (containerSize
  // is set by the hook's ResizeObserver effect on a follow-up commit) and
  // the dagre layout has produced non-zero content dims. Subsequent
  // zoom/pan are user-driven and shouldn't auto-fit again — the ref guard
  // makes this a one-shot.
  //
  // `hasFitted` is the visibility gate for the content layer: until the
  // initial fit lands the nodes sit at their pre-zoom origin, which
  // shows up as a brief flash of un-positioned tiles. We render them
  // hidden (opacity: 0) until fitToView runs, then fade in.
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
  const envNodes = layout?.nodes.filter(n => !n.isSetup) ?? [];

  const envMap = useMemo(() => {
    const map = new Map<string, Environment>();
    for (const env of environments) map.set(env.name, env);
    return map;
  }, [environments]);

  const isTargetProjectBlocked = useMemo(
    () => makeIsTargetProjectBlocked(environments),
    [environments],
  );

  if (!layout) {
    return null;
  }

  const handleBackgroundClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClearSelection();
    }
  };

  return (
    <Box
      className={classes.canvasFrame}
      style={{
        ['--canvas-dots' as string]: tokens.graph.canvasDotPattern,
      }}
    >
      {/*
        The canvas container + content divs are the d3-zoom drag/wheel
        surfaces and also handle a target-equality "click background to
        deselect" gesture. Keyboard users navigate via the focusable node
        tiles inside, so wiring keyboard listeners onto the surface
        would be misleading.
      */}
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
            // Hide until fitToView lands so users don't see the flash
            // of un-positioned nodes at their pre-zoom origin.
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
              <SetupCard
                compact
                loading={loading}
                environmentsExist={environments.length > 0}
                isWorkloadEditorSupported={isWorkloadEditorSupported}
                onConfigureWorkload={onConfigureWorkload}
                selected={selectedSetup}
                hasError={!!componentError}
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
                  isTargetProjectBlocked={isTargetProjectBlocked}
                  actionTrackers={actionTrackers}
                  activeIncidentCount={
                    incidentsSummaries?.get(env.name)?.activeCount
                  }
                  onSelect={() => onSelectEnv(env.name)}
                  onRefresh={() => onRefreshEnv(env.name)}
                  onOpenOverrides={() => onOpenOverrides(env)}
                  onOpenReleaseDetails={() => onOpenReleaseDetails(env)}
                  onPromote={target => onPromote(env, target)}
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
