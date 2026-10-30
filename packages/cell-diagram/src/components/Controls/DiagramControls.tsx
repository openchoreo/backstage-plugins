import { FC } from 'react';
import {
  FullScreenIcon,
  FitScreenIcon,
  AddIcon,
  RemoveIcon,
  RefreshIcon,
} from '../../resources/assets/icons';
import styled from '@emotion/styled';
import { PANEL_REVEAL_CLASS, panelRevealStyles } from '../../utils/animations';
import { DiagramEngine } from '@projectstorm/react-diagrams';
import { CanvasControlButton } from './ControlButtons/ControlButton';

interface ControlProps {
  engine: DiagramEngine;
  animation?: boolean;
  refreshDiagram?: () => void;
}

export const ControlPanel: FC<any> = styled.div`
  bottom: 15px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  justify-content: space-between;
  position: absolute;
  right: 15px;
  width: 32px;
  ${panelRevealStyles}
`;

export function DiagramControls(props: ControlProps) {
  const { engine, animation = true, refreshDiagram } = props;

  const onZoom = (zoomIn: boolean) => {
    const delta: number = zoomIn ? +5 : -5;
    engine.getModel().setZoomLevel(engine.getModel().getZoomLevel() + delta);
    engine.repaintCanvas();
  };

  const zoomToFit = () => {
    engine.zoomToFitNodes({ margin: 10, maxZoom: 1 });
  };

  const zoomToActualSize = () => {
    engine.getModel().setZoomLevel(100);
    engine.repaintCanvas();
  };

  return (
    <ControlPanel className={animation ? PANEL_REVEAL_CLASS : undefined}>
      {refreshDiagram && (
        <CanvasControlButton onClick={refreshDiagram} tooltipTitle="Refresh">
          <RefreshIcon />
        </CanvasControlButton>
      )}

      <CanvasControlButton onClick={zoomToFit} tooltipTitle="Zoom to fit nodes">
        <FullScreenIcon />
      </CanvasControlButton>

      <CanvasControlButton
        onClick={zoomToActualSize}
        tooltipTitle="Zoom to actual size"
      >
        <FitScreenIcon />
      </CanvasControlButton>

      <div>
        <CanvasControlButton
          onClick={() => {
            onZoom(true);
          }}
          tooltipTitle="Zoom in"
        >
          <AddIcon />
        </CanvasControlButton>

        <CanvasControlButton
          onClick={() => {
            onZoom(false);
          }}
          tooltipTitle="Zoom out"
        >
          <RemoveIcon />
        </CanvasControlButton>
      </div>
    </ControlPanel>
  );
}
