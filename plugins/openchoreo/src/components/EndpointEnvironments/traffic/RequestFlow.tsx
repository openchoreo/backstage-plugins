import { useId, useLayoutEffect, useRef, useState } from 'react';
import { alpha, useTheme } from '@material-ui/core/styles';
import { WebAppIcon } from '@openchoreo/cell-diagram';
import {
  flowLabel,
  inMatchOrder,
  isMirror,
  splitPercents,
  type EndpointTrafficBackend,
} from '@openchoreo/backstage-plugin-common';
import { useBackendColors } from './TrafficSplitBar';

const WIDTH = 650;
const ROW = 56;
const PAD = 12;
const POINT_X = 40;
const POINT_RADIUS = 6;
const BRANCH_X = 130;
const NODE_X = 440;
const RADIUS = 15;
const FONT = 11;
const MAX_LABEL = 38;
const PILL_HEIGHT = 20;
const PILL_PAD = 8;

const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

/** A lane's share, condition or copy, as a pill that ends at `right`. */
const LanePill = ({
  text,
  right,
  y,
}: {
  text: string;
  right: number;
  y: number;
}) => {
  const theme = useTheme();
  const ref = useRef<SVGTextElement>(null);
  const [width, setWidth] = useState(text.length * FONT * 0.6);
  useLayoutEffect(() => {
    const t = ref.current;
    if (t && typeof t.getComputedTextLength === 'function') {
      const measured = t.getComputedTextLength();
      if (measured > 0) setWidth(measured);
    }
  }, [text]);
  const w = width + PILL_PAD * 2;
  return (
    <g>
      <rect
        x={right - w}
        y={y - PILL_HEIGHT / 2}
        width={w}
        height={PILL_HEIGHT}
        rx={PILL_HEIGHT / 2}
        fill={theme.palette.background.paper}
        stroke={theme.palette.divider}
      />
      <text
        ref={ref}
        x={right - w / 2}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={FONT}
        fill={theme.palette.text.primary}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        <title>{text}</title>
        {clip(text, MAX_LABEL)}
      </text>
    </g>
  );
};

/**
 * How the Endpoint routes requests, left to right, drawn as the Cell Diagram
 * draws it: requests come into the Endpoint's point, which forks to one lane
 * per backend. Each lane is in the backend's colour and as thick as its
 * share, with its share, condition or copy in a pill before the backend, and
 * the backend's release line as a badge. Copies are dashed and a backend
 * that gets nothing is faded.
 */
export const RequestFlow = ({
  backends,
  colors,
}: {
  backends: EndpointTrafficBackend[];
  colors?: Map<string, string>;
}) => {
  const theme = useTheme();
  const id = `flow-${useId().replace(/:/g, '')}`;
  const fallback = useBackendColors(backends);
  const palette = colors ?? fallback;
  const shared = backends.filter(b => !isMirror(b));
  const pct = splitPercents(shared.map(b => b.weight));
  const shareOf = (name: string) => pct[shared.findIndex(b => b.name === name)];
  const height = Math.max(1, backends.length) * ROW + PAD * 2;
  const pointY = height / 2;
  const muted = theme.palette.text.secondary;

  // Conditions first, in the order they're checked, then the shares, then
  // the copies, as requests are routed.
  const ordered = [
    ...inMatchOrder(backends.filter(b => b.match && !isMirror(b))),
    ...backends.filter(b => !b.match && !isMirror(b)),
    ...backends.filter(isMirror),
  ];
  const lanes = ordered.map((b, i) => {
    const y = PAD + ROW * (i + 0.5);
    const share = isMirror(b) ? undefined : shareOf(b.name);
    const label = flowLabel(b, share);
    const idle = b.mirror
      ? b.mirror.percent === 0
      : !b.match && (share ?? 0) === 0;
    const color = palette.get(b.name) ?? theme.palette.primary.main;
    const width = 1.25 + ((share ?? 0) / 100) * 3;
    return { b, y, label, idle, color, width, dashed: isMirror(b) };
  });

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      width="100%"
      style={{
        maxWidth: WIDTH,
        display: 'block',
        fontFamily: theme.typography.fontFamily,
      }}
      role="img"
      aria-label={`The Endpoint sends ${lanes
        .map(l => `${l.b.name} ${l.label}`)
        .join(', ')}`}
    >
      <defs>
        {lanes.map((l, i) => (
          <marker
            key={l.b.name}
            id={`${id}-${i}`}
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="6"
            markerHeight="6"
            markerUnits="userSpaceOnUse"
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 z" fill={l.color} />
          </marker>
        ))}
      </defs>

      <line
        x1={PAD}
        y1={pointY}
        x2={POINT_X - POINT_RADIUS}
        y2={pointY}
        stroke={muted}
        strokeWidth={1.5}
      />

      {lanes.map((l, i) => {
        const x0 = POINT_X + POINT_RADIUS;
        const x2 = NODE_X - RADIUS - 6;
        const path = `M${x0},${pointY} C${x0 + 50},${pointY} ${BRANCH_X - 50},${
          l.y
        } ${BRANCH_X},${l.y} L${x2},${l.y}`;
        return (
          <g key={l.b.name} opacity={l.idle ? 0.4 : 1}>
            <path
              d={path}
              fill="none"
              stroke={l.color}
              strokeOpacity={0.7}
              strokeWidth={l.width}
              strokeLinecap="round"
              strokeDasharray={l.dashed ? '4 4' : undefined}
              markerEnd={`url(#${id}-${i})`}
            />
            {lanes.length > 1 && (
              <LanePill text={l.label} right={x2 - 14} y={l.y} />
            )}
          </g>
        );
      })}

      <circle
        cx={POINT_X}
        cy={pointY}
        r={POINT_RADIUS}
        fill={theme.palette.background.default}
        stroke={muted}
        strokeWidth={2}
      >
        <title>Endpoint</title>
      </circle>

      {lanes.map(l => (
        <g key={`node-${l.b.name}`} opacity={l.idle ? 0.5 : 1}>
          <circle
            cx={NODE_X}
            cy={l.y}
            r={RADIUS}
            fill={alpha(l.color, 0.1)}
            stroke={alpha(l.color, 0.6)}
            strokeWidth={1.5}
            strokeDasharray={l.dashed ? '3 3' : undefined}
          />
          <foreignObject x={NODE_X - 8} y={l.y - 8} width={16} height={16}>
            <WebAppIcon
              styles={{
                width: 16,
                height: 16,
                display: 'block',
                color: l.color,
              }}
            />
          </foreignObject>
          <foreignObject
            x={NODE_X + RADIUS + 10}
            y={l.y - ROW / 2}
            width={WIDTH - NODE_X - RADIUS - 10}
            height={ROW}
          >
            <div
              style={{
                height: ROW,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: 2,
                color: theme.palette.text.primary,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {l.b.name}
              </span>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  minWidth: 0,
                  fontSize: FONT,
                  color: muted,
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ flexShrink: 0 }}>{l.b.componentName}</span>
                {l.b.releaseLine && (
                  <span
                    style={{
                      flexShrink: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      fontSize: 10,
                      lineHeight: 1.4,
                      padding: '0 6px',
                      borderRadius: 999,
                      border: `1px solid ${theme.palette.primary.main}`,
                      color: theme.palette.primary.main,
                      background: alpha(theme.palette.primary.main, 0.1),
                    }}
                  >
                    {l.b.releaseLine}
                  </span>
                )}
                <span style={{ flexShrink: 0 }}>/ {l.b.endpoint}</span>
              </span>
            </div>
          </foreignObject>
        </g>
      ))}
    </svg>
  );
};
