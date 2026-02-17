import Box from '@material-ui/core/Box';
import { useTheme } from '@material-ui/core/styles';

export type GraphSkeletonProps = {
  className?: string;
};

export function GraphSkeleton({ className }: GraphSkeletonProps) {
  const theme = useTheme();
  const isDark = theme.palette.type === 'dark';
  const fill = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)';
  const stroke = isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.14)';
  const accent = isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.18)';

  // Node dimensions matching real nodes
  const nw = 130;
  const nh = 38;
  const r = 10;
  const aw = 8; // accent stripe width

  // Layout: left(1) → middle(2) → right(2)
  const gap = 70; // horizontal gap between columns
  const vGap = 12; // vertical gap between stacked nodes
  const col0 = 0;
  const col1 = nw + gap;
  const col2 = col1 + nw + gap;
  const stackH = nh * 2 + vGap; // total height of a 2-node stack
  const centerY = stackH / 2; // vertical center

  const nodes = [
    { x: col0, y: centerY - nh / 2 }, // left (centered)
    { x: col1, y: 0 }, // middle-top
    { x: col1, y: nh + vGap }, // middle-bottom
    { x: col2, y: 0 }, // right-top
    { x: col2, y: nh + vGap }, // right-bottom
  ];

  // Edges: left→mid-top, left→mid-bottom, mid-top→right-top, mid-bottom→right-bottom
  const edges = [
    [0, 1],
    [0, 2],
    [1, 3],
    [2, 4],
  ];

  const svgW = col2 + nw;
  const svgH = stackH;

  return (
    <Box className={className}>
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
        <g>
          {edges.map(([from, to], i) => (
            <line
              key={i}
              x1={nodes[from].x + nw}
              y1={nodes[from].y + nh / 2}
              x2={nodes[to].x}
              y2={nodes[to].y + nh / 2}
              stroke={stroke}
              strokeWidth={1.5}
            />
          ))}
          {nodes.map((n, i) => (
            <g key={i}>
              <rect
                x={n.x}
                y={n.y}
                width={nw}
                height={nh}
                rx={r}
                fill={fill}
                stroke={stroke}
                strokeWidth={1.5}
              />
              <rect
                x={n.x}
                y={n.y}
                width={aw}
                height={nh}
                rx={r}
                fill={accent}
                clipPath={`inset(0 ${nw - aw}px 0 0)`}
              />
            </g>
          ))}
        </g>
      </svg>
    </Box>
  );
}
