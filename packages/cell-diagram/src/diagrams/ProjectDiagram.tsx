/*
 * Copyright (c) 2025, WSO2 LLC. (http://www.wso2.com) All Rights Reserved.
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { MouseEvent, useEffect, useRef, useState } from "react";
import { DiagramEngine, DiagramModel } from "@projectstorm/react-diagrams";
import { CanvasWidget } from "@projectstorm/react-canvas-core";
import {
    generateEngine,
    getComponentDiagramWidth,
    getDiagramDataFromProject,
    manualDistribute,
    calculateCellWidth,
    isRenderInsideCell,
    animateProjectDiagram,
} from "../utils";
import { DiagramControls, OverlayLayerModel, CellDiagramContext, PromptScreen, ConnectionModel } from "../components";
import { Colors, DIAGRAM_END, MAIN_CELL, MARGIN, NO_CELL_NODE } from "../resources";
import { Container, DiagramContainer, useStyles } from "../utils/CanvasStyles";
import { CustomTooltips, DiagramLayer, MoreVertMenuItem, ObservationSummary, Project } from "../types";
import { CellModel } from "../components/Cell/CellNode/CellModel";
import { DiagramLayers } from "../components/Controls/DiagramLayers";
import { DiagramLegend } from "../components/Controls/DiagramLegend";
import CircularProgress from "@mui/material/CircularProgress";

export { DiagramLayer } from "../types";
export type { MoreVertMenuItem, Project } from "../types";

export interface ProjectDiagramProps {
    project: Project;
    componentMenu?: MoreVertMenuItem[];
    showControls?: boolean;
    animation?: boolean;
    defaultDiagramLayer?: DiagramLayer;
    customTooltips?: CustomTooltips;
    modelVersion?: string;
    onComponentDoubleClick?: (componentId: string) => void;
    previewMode?: boolean;
}

export function ProjectDiagram(props: ProjectDiagramProps) {
    const {
        project,
        componentMenu,
        showControls = true,
        animation = true,
        defaultDiagramLayer = DiagramLayer.ARCHITECTURE,
        customTooltips,
        modelVersion,
        onComponentDoubleClick,
        previewMode = false,
    } = props;

    const [diagramEngine] = useState<DiagramEngine>(generateEngine(previewMode));
    const [diagramModel, setDiagramModel] = useState<DiagramModel | undefined>(undefined);
    const [selectedNodeId, setSelectedNodeId] = useState<string>("");
    const [focusedNodeId, setFocusedNodeId] = useState<string>("");
    const [userMessage, setUserMessage] = useState<string>("");
    const [zoomLevel, setZoomLevel] = useState(1);
    const [isDiagramLoaded, setIsDiagramLoaded] = useState(false);

    const cellNodeWidth = useRef<number>(0); // INFO: use this reference to check if cell node width should change
    const observationSummary = useRef<ObservationSummary | null>(null);

    const styles = useStyles();

    useEffect(() => {
        if (diagramEngine) {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            drawDiagram();
        }
        return () => {
            diagramEngine
                .getModel()
                ?.getNodes()
                .forEach((node) => {
                    if (isRenderInsideCell(node)) {
                        node.clearListeners();
                    }
                });
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props]);

    useEffect(() => {
        if (diagramEngine && animation && isDiagramLoaded) {
            animateProjectDiagram();
            diagramEngine.repaintCanvas();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isDiagramLoaded, diagramEngine]);

    useEffect(() => {
        const listener = diagramEngine.getModel()?.registerListener({
            zoomUpdated: (event: any) => {
                setZoomLevel(event.zoom);
            },
        });
        return () => {
            diagramEngine.getModel()?.deregisterListener(listener);
        };
    }, [diagramEngine]);

    useEffect(() => {
        if (diagramEngine.getCanvas()) {
            document.addEventListener("keydown", handleEscapePress);
        }
        return () => {
            document.removeEventListener("keydown", handleEscapePress);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [diagramModel, diagramEngine.getCanvas()]);

    function handleEscapePress(event: KeyboardEvent) {
        if (event.key === "Escape" && selectedNodeId) {
            setSelectedNodeId("");
        }
    }

    // draw diagram
    const drawDiagram = () => {
        // get diagram data (nodes, links, gateways) from project
        const diagramData = getDiagramDataFromProject(project);
        // auto distribute component nodes, component links, empty nodes and cell links
        // get component diagram boundaries
        // calculate component diagram width
        const componentDiagramWidth = getComponentDiagramWidth(diagramData);
        cellNodeWidth.current = componentDiagramWidth;
        // get cell node
        const cellNode = new CellModel(
            MAIN_CELL,
            componentDiagramWidth,
            diagramData.gateways,
            Array.from((diagramData.nodes.connectorNodes as Map<string, ConnectionModel>).values()),
            Array.from((diagramData.nodes.connectionNodes as Map<string, ConnectionModel>).values())
        );
        // create diagram model
        const model = new DiagramModel();
        // add preloader overlay layer
        model.addLayer(new OverlayLayerModel());
        // add node and links to diagram model
        const models = model.addAll(
            // nodes
            cellNode,
            ...diagramData.nodes.componentNodes.values(),
            ...diagramData.nodes.connectionNodes.values(),
            ...diagramData.nodes.connectorNodes.values(),
            ...diagramData.nodes.emptyNodes.values(),
            ...diagramData.nodes.externalNodes.values(),
            // links
            ...diagramData.links.connectionLinks.values(),
            ...diagramData.links.connectorLinks.values(),
            ...diagramData.links.externalLinks.values(),
            ...diagramData.links.componentLinks.values(),
            ...diagramData.links.cellLinks.values(),
            ...diagramData.links.externalConnectionLinks.values()
        );

        models.forEach((item) => {
            if (isRenderInsideCell(item)) {
                item.registerListener({
                    positionChanged: () => {
                        // eslint-disable-next-line @typescript-eslint/no-use-before-define
                        refreshDiagram();
                    },
                });
            }
        });
        // initially render end of diagram
        model.setOffset(DIAGRAM_END * 4, DIAGRAM_END * 4);
        // draw diagram with all nodes and links
        diagramEngine.setModel(model);
        setDiagramModel(model);

        if (previewMode) {
            // Disable dragging for all nodes
            diagramEngine.getModel().setLocked(true);
            const state = diagramEngine.getStateMachine().getCurrentState();
            (state as any).dragCanvas.config.allowDrag = false;
        }

        // update observability summary
        observationSummary.current = diagramData.observationSummary;

        setTimeout(() => {
            // manual distribute - update empty node, external node and connector node position based on cell node position
            manualDistribute(model);
            if (diagramEngine.getCanvas()?.getBoundingClientRect !== undefined) {
                // zoom to fit nodes and center diagram
                diagramEngine.zoomToFitNodes({ 
                    margin: previewMode ? MARGIN.PREVIEW : MARGIN.DEFAULT, 
                    maxZoom: 1 
                });
            }
            // remove preloader overlay layer
            const overlayLayer = diagramEngine
                .getModel()
                .getLayers()
                .find((layer) => layer instanceof OverlayLayerModel);
            if (overlayLayer) {
                diagramEngine.getModel().removeLayer(overlayLayer);
            }
            // update diagram
            diagramEngine.setModel(model);
            diagramEngine.repaintCanvas();
            // After all diagram setup is complete
            setIsDiagramLoaded(true);
        }, 1000);
    };

    // refresh diagram
    const refreshDiagram = () => {
        // calculate component diagram width
        const model = diagramEngine.getModel();
        const cellWidth = calculateCellWidth(model);
        // TODO: check if cell node width should change
        const cellNode = model.getNode(MAIN_CELL);
        // change cell node width
        if (!cellNode) {
            setUserMessage(NO_CELL_NODE); // TODO: handle error properly
            return;
        }
        cellNode.width = cellWidth;
        cellNode.updateDimensions({ width: cellWidth, height: cellWidth });

        setTimeout(() => {
            // manual distribute - update empty node, external node and connector node position based on cell node position
            manualDistribute(model);
            // update diagram
            diagramEngine.setModel(model);
            diagramEngine.repaintCanvas();
            // update cell node width
            cellNodeWidth.current = cellWidth;
        }, 8);
    };

    const showDiagramLayers =
        (showControls && (observationSummary.current?.requestCount.max ?? 0) > 0 && !previewMode) || false;

    const ctx = {
        selectedNodeId,
        focusedNodeId,
        componentMenu,
        zoomLevel,
        observationSummary: observationSummary.current ?? undefined,
        defaultDiagramLayer,
        modelVersion : modelVersion || "v1", 
        setSelectedNodeId,
        setFocusedNodeId,
        onComponentDoubleClick,
        previewMode
    };

    const handleCanvasClick = (event: MouseEvent<HTMLDivElement, globalThis.MouseEvent>) => {
        if (previewMode && onComponentDoubleClick) {
            // In preview mode, clicking anywhere on the canvas should trigger the onComponentDoubleClick
            onComponentDoubleClick(MAIN_CELL);
            return;
        }
        
        if (focusedNodeId && event.target === diagramEngine.getCanvas()) {
            setFocusedNodeId("");
        }
    };



    let diagramContent;
    if (diagramEngine?.getModel() && diagramModel) {
        diagramContent = (
            <>
                <CanvasWidget
                    engine={diagramEngine}
                    className={`${styles.canvas} cell-diagram-canvas`}
                />
                {showControls && !previewMode && <DiagramControls engine={diagramEngine} animation={animation} />}
                {showDiagramLayers && (
                    <DiagramLayers animation={animation} tooltips={customTooltips?.diagramLayers} />
                )}
                {showDiagramLayers && <DiagramLegend animation={animation} />}
            </>
        );
    } else if (userMessage) {
        diagramContent = <PromptScreen userMessage={userMessage} />;
    } else {
        diagramContent = <CircularProgress sx={{ color: Colors.PRIMARY }} />;
    }

    return (
        <Container>
            <CellDiagramContext {...ctx}>
                <DiagramContainer onClick={handleCanvasClick}
                    className={previewMode ? "preview-mode" : ""
                }>
                    {diagramContent}
                </DiagramContainer>
            </CellDiagramContext>
        </Container>
    );
}
