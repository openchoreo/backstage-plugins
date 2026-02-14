import { useLayoutEffect, useRef, useState } from 'react';
import { DependencyGraphTypes } from '@backstage/core-components';
import { useTheme } from '@material-ui/core/styles';
import { EntityEdgeData } from '@backstage/plugin-catalog-graph';

export function DefaultRenderLabel({
  edge: { relations },
}: DependencyGraphTypes.RenderLabelProps<EntityEdgeData>) {
  const theme = useTheme();
  const textRef = useRef<SVGTextElement>(null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    if (textRef.current) {
      const bbox = textRef.current.getBBox();
      setBox({ width: bbox.width, height: bbox.height });
    }
  }, [relations]);

  const isDark = theme.palette.type === 'dark';
  const pillFill = isDark ? 'rgba(30,30,30,0.65)' : 'rgba(255,255,255,0.75)';
  const padX = 6;
  const padY = 3;

  return (
    <g>
      {box && (
        <rect
          x={-box.width / 2 - padX}
          y={-box.height / 2 - padY}
          width={box.width + padX * 2}
          height={box.height + padY * 2}
          rx={4}
          fill={pillFill}
          stroke={theme.palette.divider}
          strokeWidth={0.5}
        />
      )}
      <text
        ref={textRef}
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          fill: theme.palette.text.secondary,
          fontSize: '0.65rem',
          fontWeight: 500,
          letterSpacing: '0.02em',
        }}
      >
        {relations.map((r, i) => (
          <tspan
            key={r}
            style={i % 2 !== 0 ? { fill: theme.palette.text.disabled } : {}}
          >
            {i > 0 && <tspan> / </tspan>}
            {r}
          </tspan>
        ))}
      </text>
    </g>
  );
}
