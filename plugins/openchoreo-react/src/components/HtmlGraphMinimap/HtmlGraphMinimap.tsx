import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  MouseEvent as ReactMouseEvent,
} from 'react';
import Box from '@material-ui/core/Box';
import { makeStyles } from '@material-ui/core/styles';
import { useChoreoTokens } from '@openchoreo/backstage-design-system';
import type { GraphViewBox, GraphViewport } from '../../hooks/useGraphZoom';

const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = 140;

const useStyles = makeStyles(theme => ({
  root: {
    width: MINIMAP_WIDTH,
    height: MINIMAP_HEIGHT,
    backgroundColor: 'var(--minimap-mask)',
    backgroundImage: 'var(--minimap-dots)',
    backgroundSize: '12px 12px',
    backdropFilter: 'blur(8px)',
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: 'var(--minimap-shadow)',
    borderRadius: theme.shape.borderRadius,
    overflow: 'hidden',
    cursor: 'crosshair',
    position: 'relative',
  },
  svg: {
    display: 'block',
    width: '100%',
    height: '100%',
  },
  nodeRect: {
    fill: theme.palette.action.disabledBackground,
    stroke: theme.palette.divider,
    strokeWidth: 1,
  },
  dimOverlay: {
    fill: 'var(--minimap-dim)',
  },
  viewportRect: {
    fill: 'var(--minimap-viewport-tint)',
    stroke: 'var(--minimap-viewport-border)',
    strokeWidth: 2,
    cursor: 'grab',
  },
  viewportRectDragging: {
    fill: 'var(--minimap-viewport-tint-active)',
    stroke: 'var(--minimap-viewport-border)',
    strokeWidth: 2,
    cursor: 'grabbing',
  },
}));

export interface HtmlGraphMinimapNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  highlighted?: boolean;
}

export interface HtmlGraphMinimapProps {
  /** Content (DAG) coordinate-system size. */
  viewBox: GraphViewBox;
  /** Visible window in content coordinates. */
  viewport: GraphViewport;
  /** Node thumbnails to render in the minimap, in content coordinates. */
  nodes: HtmlGraphMinimapNode[];
  /** Pan callback receiving content-space coordinates. */
  onPan: (svgX: number, svgY: number) => void;
}

/**
 * Compact preview of the deploy-tab DAG. Mirrors `GraphMinimap`'s
 * interaction model (click to recenter, drag the viewport rect to pan)
 * but renders node thumbnails directly as SVG `<rect>` shapes — there's
 * no SVG workspace to mirror via `<use href>`.
 */
export function HtmlGraphMinimap({
  viewBox,
  viewport,
  nodes,
  onPan,
}: HtmlGraphMinimapProps) {
  const classes = useStyles();
  const tokens = useChoreoTokens();
  const svgElRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  // Per-instance SVG mask id so multiple minimaps on the same page
  // don't share (and dim each other through) the same `<mask>` element.
  const maskId = useId();
  // Refs to the most recently registered window listeners. Cleared by
  // the listeners themselves when a drag completes; cleaned up by the
  // unmount effect below if the component tears down mid-drag.
  const moveHandlerRef = useRef<((e: globalThis.MouseEvent) => void) | null>(
    null,
  );
  const upHandlerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (moveHandlerRef.current) {
        window.removeEventListener('mousemove', moveHandlerRef.current);
      }
      if (upHandlerRef.current) {
        window.removeEventListener('mouseup', upHandlerRef.current);
      }
    };
  }, []);

  const toSvgCoords = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgElRef.current;
      if (!svg || viewBox.width === 0 || viewBox.height === 0) {
        return { x: 0, y: 0 };
      }
      const rect = svg.getBoundingClientRect();
      const ratioX = viewBox.width / rect.width;
      const ratioY = viewBox.height / rect.height;
      return {
        x: (clientX - rect.left) * ratioX,
        y: (clientY - rect.top) * ratioY,
      };
    },
    [viewBox],
  );

  const handleClick = useCallback(
    (e: ReactMouseEvent<SVGSVGElement>) => {
      if (dragging) return;
      const coords = toSvgCoords(e.clientX, e.clientY);
      onPan(coords.x, coords.y);
    },
    [dragging, toSvgCoords, onPan],
  );

  const handleRectMouseDown = useCallback(
    (e: ReactMouseEvent<SVGRectElement>) => {
      e.stopPropagation();
      setDragging(true);
      const coords = toSvgCoords(e.clientX, e.clientY);
      dragOffsetRef.current = {
        x: coords.x - (viewport.x + viewport.width / 2),
        y: coords.y - (viewport.y + viewport.height / 2),
      };

      const handleMouseMove = (me: globalThis.MouseEvent) => {
        const moveCoords = toSvgCoords(me.clientX, me.clientY);
        onPan(
          moveCoords.x - dragOffsetRef.current.x,
          moveCoords.y - dragOffsetRef.current.y,
        );
      };

      const handleMouseUp = () => {
        setDragging(false);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        moveHandlerRef.current = null;
        upHandlerRef.current = null;
      };

      moveHandlerRef.current = handleMouseMove;
      upHandlerRef.current = handleMouseUp;
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [toSvgCoords, viewport, onPan],
  );

  if (viewBox.width === 0 || viewBox.height === 0) return null;

  return (
    <Box
      className={classes.root}
      style={{
        ['--minimap-mask' as string]: tokens.graph.minimapMask,
        ['--minimap-dots' as string]: tokens.graph.minimapDotPattern,
        ['--minimap-shadow' as string]: tokens.shadow.md,
        ['--minimap-dim' as string]: tokens.scrim.med,
        ['--minimap-viewport-tint' as string]: tokens.graph.minimapViewportTint,
        ['--minimap-viewport-tint-active' as string]:
          tokens.graph.minimapViewportTintActive,
        ['--minimap-viewport-border' as string]:
          tokens.graph.minimapViewportBorder,
      }}
    >
      <svg
        ref={svgElRef}
        className={classes.svg}
        viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
        preserveAspectRatio="xMidYMid meet"
        onClick={handleClick}
      >
        {nodes.map(node => (
          <rect
            key={node.id}
            x={node.x}
            y={node.y}
            width={node.width}
            height={node.height}
            className={classes.nodeRect}
            rx={4}
            ry={4}
          />
        ))}

        <defs>
          <mask id={maskId}>
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={viewport.x}
              y={viewport.y}
              width={viewport.width}
              height={viewport.height}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          className={classes.dimOverlay}
          mask={`url(#${maskId})`}
        />

        <rect
          x={viewport.x}
          y={viewport.y}
          width={viewport.width}
          height={viewport.height}
          className={
            dragging ? classes.viewportRectDragging : classes.viewportRect
          }
          onMouseDown={handleRectMouseDown}
        />
      </svg>
    </Box>
  );
}
