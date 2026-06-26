import { FC, useEffect, useRef, useState } from "react";
import styled from "@emotion/styled";
import gsap from "gsap";
import { useDiagramContext } from "../DiagramContext/DiagramContext";
import { DiagramIcon, DiffIcon, LayersIcon, ObservationIcon } from "../../resources";
import { DiagramLayer, DiagramLayerTooltips } from "../../types";
import { CanvasControlButton } from "./ControlButtons/ControlButton";
import { LayerButton } from "./LayerButton";

export const DiagramLayersPanel: FC<any> = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: end;
    gap: 4px;
    position: absolute;
    bottom: 15px;
    left: 15px;
`;

export const LayersPanel: FC<any> = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 6px 6px 4px;
    background-color: ${({ theme }) => theme.colors.SURFACE_BRIGHT};
    border: 1px solid ${({ theme }) => theme.colors.SURFACE_DIM};
`;

export const MainButton: FC<any> = styled.div`
    border: 1px solid ${({ theme }) => theme.colors.SURFACE_DIM};
    width: 34px;
    height: 34px;
    border-radius: 2px;
    color: ${({ theme, selected }: { theme: any; selected?: boolean }) =>
        selected ? theme.colors.PRIMARY : theme.colors.OUTLINE_VARIANT};
    background-color: ${({ theme }) => theme.colors.SURFACE_BRIGHT};
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative;
    box-sizing: border-box;
    padding: 5px;
    cursor: pointer;
    &:active {
        background-color: ${({ theme }) => theme.colors.SURFACE_DIM};
    }
`;

export const LayerIcon: FC<any> = styled.div`
    width: 40px;
    height: 40px;
    border-radius: 2px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative;
    box-sizing: border-box;
    padding: 4px;
`;

interface DiagramLayersProps {
    animation?: boolean;
    tooltips?: DiagramLayerTooltips;
}

export function DiagramLayers(props: DiagramLayersProps) {
    const { animation = true, tooltips } = props;
    const {
        diagramLayers: { addLayer, removeLayer, hasLayer, activeLayers },
    } = useDiagramContext();
    const [hover, setHover] = useState(true);
    const controlPanelRef = useRef(null);
    const canRemoveLayer = activeLayers.length > 1;

    useEffect(() => {
        if (animation) {
            gsap.fromTo(
                controlPanelRef.current,
                { scale: 0 },
                {
                    scale: 1,
                    duration: 1,
                    ease: "power3.out",
                    delay: 1,
                }
            );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const toggleArchitectureLayer = () => {
        if (hasLayer(DiagramLayer.ARCHITECTURE)) {
            removeLayer(DiagramLayer.ARCHITECTURE);
        } else {
            addLayer(DiagramLayer.ARCHITECTURE);
        }
    };

    const toggleObservabilityLayer = () => {
        if (hasLayer(DiagramLayer.OBSERVABILITY)) {
            removeLayer(DiagramLayer.OBSERVABILITY);
        } else {
            addLayer(DiagramLayer.OBSERVABILITY);
        }
    };

    const toggleDiffLayer = () => {
        if (hasLayer(DiagramLayer.DIFF)) {
            removeLayer(DiagramLayer.DIFF);
        } else {
            addLayer(DiagramLayer.DIFF);
        }
    };

    const toggleDiagramLayerPanel = () => {
        setHover((prev) => !prev);
    };

    return (
        <DiagramLayersPanel ref={controlPanelRef}>
            <CanvasControlButton onClick={toggleDiagramLayerPanel} tooltipTitle={!hover ? "Toggle architecture layers" : ""}>
                <LayersIcon />
            </CanvasControlButton>
            {hover && (
                <LayersPanel>
                    <LayerButton
                        onClick={toggleArchitectureLayer}
                        selected={hasLayer(DiagramLayer.ARCHITECTURE)}
                        clickable={hasLayer(DiagramLayer.ARCHITECTURE) ? canRemoveLayer : true}
                        tooltipTitle="Toggle static architecture layer"
                        tooltipDescription={
                            tooltips?.staticLayer ||
                            "Visualize the static architecture defined in the component-config.yaml file. This layer represents the intended architecture of the system and shows the connections between components as specified by the user."
                        }
                    >
                        <LayerIcon>
                            <DiagramIcon styles={{ width: 24, height: 24 }} />
                        </LayerIcon>
                        Static
                    </LayerButton>
                    <LayerButton
                        onClick={toggleObservabilityLayer}
                        selected={hasLayer(DiagramLayer.OBSERVABILITY)}
                        clickable={hasLayer(DiagramLayer.OBSERVABILITY) ? canRemoveLayer : true}
                        tooltipTitle="Toggle runtime architecture layer"
                        tooltipDescription={
                            tooltips?.runtimeLayer ||
                            "Visualize the runtime architecture of the system. This layer represents the actual runtime architecture of the system and shows the connections between components based on observability data."
                        }
                    >
                        <LayerIcon>
                            <ObservationIcon styles={{ width: 24, height: 24 }} />
                        </LayerIcon>
                        Runtime
                    </LayerButton>
                    <LayerButton
                        onClick={toggleDiffLayer}
                        selected={hasLayer(DiagramLayer.DIFF)}
                        clickable={hasLayer(DiagramLayer.DIFF) ? canRemoveLayer : true}
                        tooltipTitle="Toggle architectural drift layer"
                        tooltipDescription={
                            tooltips?.diffLayer ||
                            "Detect architectural drift by comparing the static and runtime architecture layers. This layer highlights the differences between the static and runtime architecture layers, allowing you to identify architectural drift."
                        }
                    >
                        <LayerIcon>
                            <DiffIcon styles={{ width: 24, height: 24 }} />
                        </LayerIcon>
                        Diff
                    </LayerButton>
                </LayersPanel>
            )}
        </DiagramLayersPanel>
    );
}
