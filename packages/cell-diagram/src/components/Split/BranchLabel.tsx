import { RefObject, useLayoutEffect, useRef, useState } from 'react';
import { useColors } from '../../theme';

const FONT_SIZE = 14;
const PAD_X = 10;
const HEIGHT = 24;
/** The gap between a label and the backend its line leads to. */
const BEFORE_END = 24;

interface BranchLabelProps {
  text: string;
  path: RefObject<SVGPathElement>;
  d: string;
  fallback: { x: number; y: number };
  faded?: boolean;
  /** Halfway along, when other labelled lines end at the same backend. */
  middle?: boolean;
}

/**
 * A route branch's share or condition, as a pill that ends just before the
 * backend its line leads to, or halfway along a short line.
 */
export function BranchLabel(props: BranchLabelProps) {
  const { text, path, d, fallback, faded, middle } = props;
  const colors = useColors();
  const textRef = useRef<SVGTextElement>(null);
  const [at, setAt] = useState(fallback);
  const [width, setWidth] = useState(text.length * FONT_SIZE * 0.55);

  useLayoutEffect(() => {
    const el = path.current;
    let textWidth = width;
    const t = textRef.current;
    if (t && typeof t.getComputedTextLength === 'function') {
      const measured = t.getComputedTextLength();
      if (measured > 0) {
        textWidth = measured;
        setWidth(measured);
      }
    }
    if (el && typeof el.getTotalLength === 'function') {
      const total = el.getTotalLength();
      const back = textWidth / 2 + PAD_X + BEFORE_END;
      const p = el.getPointAtLength(
        middle ? total / 2 : Math.max(total / 2, total - back),
      );
      setAt({ x: p.x, y: p.y });
    } else {
      setAt(fallback);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, text, middle]);

  const w = width + PAD_X * 2;
  return (
    <g pointerEvents="none">
      <rect
        x={at.x - w / 2}
        y={at.y - HEIGHT / 2}
        width={w}
        height={HEIGHT}
        rx={HEIGHT / 2}
        fill={colors.SURFACE_BRIGHT}
        stroke={colors.OUTLINE_VARIANT}
        strokeWidth={1}
      />
      <text
        ref={textRef}
        x={at.x}
        y={at.y}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="GilmerMedium"
        fontSize={FONT_SIZE}
        fill={colors.ON_SURFACE_VARIANT}
        opacity={faded ? 0.55 : 1}
      >
        {text}
      </text>
    </g>
  );
}
