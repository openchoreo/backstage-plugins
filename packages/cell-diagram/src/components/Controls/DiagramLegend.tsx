import { FC, useContext, useEffect, useRef } from 'react';
import styled from '@emotion/styled';
import gsap from 'gsap';
import { DiagramContext } from '../DiagramContext/DiagramContext';
import { DiagramLayer } from '../../types';
import { useColors } from '../../theme';

export const DiagramLegendPanel: FC<any> = styled.div`
  position: absolute;
  top: 15px;
  right: 15px;

  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: start;
  gap: 4px;

  padding: 8px;

  background-color: ${({ theme }) => theme.colors.SURFACE};
  border: 1px solid ${({ theme }) => theme.colors.SURFACE_DIM};
`;

export const LegendRow: FC<any> = styled.div`
  display: flex;
  align-items: center;
  font-size: 12px;
  gap: 8px;
`;

export const Text: FC<any> = styled.div`
  font-size: 12px;
  user-select: none;
  color: ${({ theme }) => theme.colors.ON_SURFACE_VARIANT};
`;

interface DiagramLegendProps {
  animation?: boolean;
}

export function DiagramLegend(props: DiagramLegendProps) {
  const { animation = true } = props;
  const colors = useColors();
  // The "hsl(0, 0%, 30%)" stroke on the legend's svg <g> is a backdrop
  // line that gets overdrawn by the actual stroke color below; we leave
  // it as-is to preserve the original visual.

  const {
    diagramLayers: { hasLayer },
  } = useContext(DiagramContext);

  const controlPanelRef = useRef(null);
  const hasArchitectureLayer = hasLayer(DiagramLayer.ARCHITECTURE);
  const hasObservabilityLayer = hasLayer(DiagramLayer.OBSERVABILITY);
  const hasDiffLayer = hasLayer(DiagramLayer.DIFF);

  useEffect(() => {
    if (animation) {
      gsap.fromTo(
        controlPanelRef.current,
        { scale: 0 },
        {
          scale: 1,
          duration: 1,
          ease: 'power3.out',
          delay: 1,
        },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DiagramLegendPanel ref={controlPanelRef}>
      {(hasObservabilityLayer || hasDiffLayer) && (
        <LegendRow>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 200 50"
            width={50}
            height={10}
          >
            <g strokeWidth="10" stroke="hsl(0, 0%, 30%)" fill="none">
              <line
                x1="0"
                y1="25"
                x2="200"
                y2="25"
                markerEnd={hasObservabilityLayer ? '' : 'url(#solidLinkArrow)'}
                stroke={
                  hasObservabilityLayer
                    ? colors.PRIMARY
                    : colors.ON_SURFACE_VARIANT
                }
              />
            </g>
            <defs>
              <marker
                id="solidLinkArrow"
                markerWidth="5"
                markerHeight="5"
                markerUnits="strokeWidth"
                refX="4"
                refY="3"
                viewBox="0 0 6 6"
                orient="auto"
              >
                <polygon
                  points="0,6 0,0 5,3"
                  fill={
                    hasObservabilityLayer
                      ? colors.PRIMARY
                      : colors.ON_SURFACE_VARIANT
                  }
                />
              </marker>
            </defs>
          </svg>
          {hasObservabilityLayer && !hasDiffLayer && (
            <Text>Only runtime dependency</Text>
          )}
          {hasObservabilityLayer && hasDiffLayer && (
            <Text>Both static and runtime dependency</Text>
          )}
          {!hasObservabilityLayer && hasDiffLayer && (
            <Text>Both static and runtime dependency</Text>
          )}
        </LegendRow>
      )}
      {hasArchitectureLayer && !hasDiffLayer && (
        <LegendRow>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 200 50"
            width={50}
            height={10}
          >
            <g strokeWidth="10" stroke="hsl(0, 0%, 30%)" fill="none">
              <line
                x1="0"
                y1="25"
                x2="200"
                y2="25"
                markerEnd={hasObservabilityLayer ? '' : 'url(#solidLinkArrow)'}
                stroke={colors.ON_SURFACE_VARIANT}
              />
            </g>
            <defs>
              <marker
                id="solidLinkArrow"
                markerWidth="5"
                markerHeight="5"
                markerUnits="strokeWidth"
                refX="4"
                refY="3"
                viewBox="0 0 6 6"
                orient="auto"
              >
                <polygon
                  points="0,6 0,0 5,3"
                  fill={colors.ON_SURFACE_VARIANT}
                />
              </marker>
            </defs>
          </svg>
          <Text>Only static dependency</Text>
        </LegendRow>
      )}
      {hasDiffLayer && (
        <LegendRow>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 200 50"
            width={50}
            height={10}
          >
            <g strokeWidth={10} stroke="hsl(0, 0%, 30%)" fill="none">
              <line
                x1={0}
                y1={25}
                x2={200}
                y2={25}
                markerEnd={hasObservabilityLayer ? '' : 'url(#redLinkArrow)'}
                stroke={colors.ERROR}
              />
            </g>
            <defs>
              <marker
                id="redLinkArrow"
                markerWidth="5"
                markerHeight="5"
                markerUnits="strokeWidth"
                refX="4"
                refY="3"
                viewBox="0 0 6 6"
                orient="auto"
              >
                <polygon points="0,6 0,0 5,3" fill={colors.ERROR} />
              </marker>
            </defs>
          </svg>
          <Text>Only runtime dependency</Text>
        </LegendRow>
      )}
      {hasDiffLayer && (
        <LegendRow>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 200 50"
            width={50}
            height={10}
          >
            <g strokeWidth="10" stroke="hsl(0, 0%, 30%)" fill="none">
              <line
                x1="0"
                y1="25"
                x2="200"
                y2="25"
                markerEnd={hasObservabilityLayer ? '' : 'url(#dashLinkArrow)'}
                strokeDasharray="20,20"
              />
            </g>
            <defs>
              <marker
                id="dashLinkArrow"
                markerWidth="5"
                markerHeight="5"
                markerUnits="strokeWidth"
                refX="4"
                refY="3"
                viewBox="0 0 6 6"
                orient="auto"
              >
                <polygon
                  points="0,6 0,0 5,3"
                  fill={colors.ON_SURFACE_VARIANT}
                />
              </marker>
            </defs>
          </svg>
          <Text>Only static dependency</Text>
        </LegendRow>
      )}
    </DiagramLegendPanel>
  );
}
