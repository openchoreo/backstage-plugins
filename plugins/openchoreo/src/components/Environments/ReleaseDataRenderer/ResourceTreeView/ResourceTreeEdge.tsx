import type { FC } from 'react';
import { useTreeStyles } from './treeStyles';
import type { TreeEdge } from './treeTypes';

interface ResourceTreeEdgeProps {
  edge: TreeEdge;
}

export const ResourceTreeEdge: FC<ResourceTreeEdgeProps> = ({ edge }) => {
  const classes = useTreeStyles();

  return (
    <>
      {edge.lines.map((line, i) => {
        const dx = line.x2 - line.x1;
        const dy = line.y2 - line.y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        const midX = (line.x1 + line.x2) / 2;
        const midY = (line.y1 + line.y2) / 2;

        return (
          <div
            key={i}
            className={classes.edgeLine}
            style={{
              width: length,
              left: midX - length / 2,
              top: midY,
              transform: `rotate(${angle}deg)`,
            }}
          />
        );
      })}
    </>
  );
};
