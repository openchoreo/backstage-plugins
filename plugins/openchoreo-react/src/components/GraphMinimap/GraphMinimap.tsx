import {
  useCallback,
  useRef,
  useState,
  MouseEvent as ReactMouseEvent,
} from 'react';
import Box from '@material-ui/core/Box';
import { makeStyles } from '@material-ui/core/styles';
import { useChoreoTokens } from '@openchoreo/backstage-design-system';
import type {
  GraphTransform,
  GraphViewBox,
  GraphViewport,
} from '../../hooks/useGraphZoom';

const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = 150;

// Token-derived values flow in via CSS custom properties on the root element,
// so makeStyles can stay static and still be fully theme-driven.
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

export type GraphMinimapProps = {
  transform: GraphTransform;
  viewBox: GraphViewBox;
  viewport: GraphViewport;
  onPan: (svgX: number, svgY: number) => void;
};

export function GraphMinimap({
  transform,
  viewBox,
  viewport,
  onPan,
}: GraphMinimapProps) {
  const classes = useStyles();
  const tokens = useChoreoTokens();
  const svgElRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

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
      };

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
        ['--minimap-viewport-tint-active' as string]: tokens.graph
          .minimapViewportBorder,
        ['--minimap-viewport-border' as string]: tokens.primary.main,
      }}
    >
      <svg
        ref={svgElRef}
        className={classes.svg}
        viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
        preserveAspectRatio="xMidYMid meet"
        onClick={handleClick}
      >
        {/* Clone the main graph workspace with inverse transform to cancel zoom */}
        <g
          transform={`scale(${
            1 / transform.k
          }) translate(${-transform.x}, ${-transform.y})`}
        >
          <use href="#workspace" />
        </g>

        {/* Dim area outside viewport */}
        <defs>
          <mask id="minimap-viewport-mask">
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
          mask="url(#minimap-viewport-mask)"
        />

        {/* Viewport rectangle */}
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
