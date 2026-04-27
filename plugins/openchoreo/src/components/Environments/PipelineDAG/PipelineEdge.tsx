import type { FC } from 'react';
import LockOutlinedIcon from '@material-ui/icons/LockOutlined';
import { usePipelineStyles } from './pipelineStyles';
import type { PipelineEdge as PipelineEdgeType } from './pipelineTypes';

interface PipelineEdgeProps {
  edge: PipelineEdgeType;
}

export const PipelineEdge: FC<PipelineEdgeProps> = ({ edge }) => {
  const classes = usePipelineStyles();

  // Compute the midpoint of all line segments for the approval icon
  const approvalIconPosition = edge.requiresApproval
    ? (() => {
        const midIndex = Math.floor(edge.lines.length / 2);
        const midLine = edge.lines[midIndex];
        return {
          x: (midLine.x1 + midLine.x2) / 2,
          y: (midLine.y1 + midLine.y2) / 2,
        };
      })()
    : null;

  // Arrow head position: end of last line segment
  const lastLine = edge.lines[edge.lines.length - 1];

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
            className={
              edge.requiresApproval
                ? classes.edgeLineApproval
                : classes.edgeLine
            }
            style={{
              width: length,
              left: midX - length / 2,
              top: midY,
              transform: `rotate(${angle}deg)`,
            }}
          />
        );
      })}

      {/* Arrow head at the end of the last segment */}
      {lastLine && (
        <div
          className={classes.arrowHead}
          style={{
            left: lastLine.x2 - 6,
            top: lastLine.y2 - 4,
          }}
        />
      )}

      {/* Approval icon at midpoint */}
      {approvalIconPosition && (
        <div
          className={classes.approvalIcon}
          style={{
            left: approvalIconPosition.x - 8,
            top: approvalIconPosition.y - 8,
          }}
        >
          <LockOutlinedIcon style={{ fontSize: 12 }} />
        </div>
      )}
    </>
  );
};
