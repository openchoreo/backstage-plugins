import { MouseEvent, useEffect, useState } from "react";
import { DiagramEngine, DiagramModel } from "@projectstorm/react-diagrams";
import { CanvasWidget } from "@projectstorm/react-canvas-core";
import CircularProgress from "@mui/material/CircularProgress";
import { generateEngine, getDiagramDataFromOrg, animateOrgDiagram } from "../utils";
import { DiagramControls, OverlayLayerModel, CellDiagramContext, ConnectionModel } from "../components";
import { CONNECTION_NODE, Colors, PROJECT_NODE } from "../resources";
import { Container, DiagramContainer, useStyles } from "../utils/CanvasStyles";
import { CustomTooltips, DiagramLayer, MoreVertMenuItem, Organization } from "../types";
import { DagreEngine } from "../resources/Dagre/DagreEngine";

export { DiagramLayer } from "../types";
export type { MoreVertMenuItem, Project } from "../types";

export interface OrgDiagramProps {
    organization: Organization;
    componentMenu?: MoreVertMenuItem[];
    showControls?: boolean;
    animation?: boolean;
    defaultDiagramLayer?: DiagramLayer;
    customTooltips?: CustomTooltips;
    onComponentDoubleClick?: (componentId: string) => void;
}

export function OrgDiagram(props: OrgDiagramProps) {
    const {
        organization,
        componentMenu,
        showControls = true,
        animation = true,
        defaultDiagramLayer = DiagramLayer.ARCHITECTURE,
        onComponentDoubleClick,
    } = props;

    const [diagramEngine] = useState<DiagramEngine>(generateEngine);
    const [diagramModel, setDiagramModel] = useState<DiagramModel | undefined>(undefined);
    const [selectedNodeId, setSelectedNodeId] = useState<string>("");
    const [focusedNodeId, setFocusedNodeId] = useState<string>("");
    const [zoomLevel, setZoomLevel] = useState(1);
    const [isDiagramLoaded, setIsDiagramLoaded] = useState(false);

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
                    node.clearListeners();
                });
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props]);

    useEffect(() => {
        if (diagramEngine && animation && isDiagramLoaded) {
            animateOrgDiagram();
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
        const diagramData = getDiagramDataFromOrg(organization);
        // create diagram model
        const model = new DiagramModel();
        // add preloader overlay layer
        model.addLayer(new OverlayLayerModel());
        // add node and links to diagram model
        const models = model.addAll(
            // nodes
            ...diagramData.nodes.projectNodes.values(),
            // links
            ...diagramData.links.projectLinks.values()
        );

        // draw diagram with all nodes and links
        diagramEngine.setModel(model);
        setDiagramModel(model);

        setTimeout(() => {
            const dagreEngine = new DagreEngine({
                graph: {
                    rankdir: "LR",
                    ranksep: 110,
                    edgesep: 44,
                    nodesep: 20,
                    // acyclicer: 'greedy',
                    ranker: "network-simplex",
                },
                includeLinks: true,
            });
            dagreEngine.redistribute(model);

            // get all links and find link in the bottom of the diagram and find y coordinate
            const links = model.getLinks();
            let maxY = 0;
            links.forEach((link) => {
                link.getPoints().forEach((point) => {
                    if (point.getY() > maxY) {
                        maxY = point.getY();
                    }
                });
            });

            // get all nodes and find node in the bottom of the diagram and find y coordinate
            const nodes = model.getNodes();
            nodes.forEach((node) => {
                if (node.getType() === PROJECT_NODE) {
                    const y = node.getY() + 120;
                    if (y > maxY) {
                        maxY = y;
                    }
                }
            });

            // update connection nodes position to the bottom of the diagram
            models.forEach((node) => {
                if (node.getType() === CONNECTION_NODE) {
                    (node as ConnectionModel).setPosition(0, maxY + 40);
                }
            });

            if (diagramEngine.getCanvas()?.getBoundingClientRect()) {
                // zoom to fit nodes and center diagram
                diagramEngine.zoomToFitNodes({ margin: 40, maxZoom: 1 });
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

    const ctx = {
        selectedNodeId,
        focusedNodeId,
        componentMenu,
        zoomLevel,
        defaultDiagramLayer,
        setSelectedNodeId,
        setFocusedNodeId,
        onComponentDoubleClick,
    };

    const handleCanvasClick = (event: MouseEvent<HTMLDivElement, globalThis.MouseEvent>) => {
        if (focusedNodeId && event.target === diagramEngine.getCanvas()) {
            setFocusedNodeId("");
        }
    };

    return (
        <Container>
            <CellDiagramContext {...ctx}>
                <DiagramContainer onClick={handleCanvasClick}>
                    {diagramEngine?.getModel() && diagramModel ? (
                        <>
                            <CanvasWidget
                                engine={diagramEngine}
                                className={styles.canvas}
                            />
                            {showControls && <DiagramControls engine={diagramEngine} animation={animation} />}
                        </>
                    ) : (
                        <CircularProgress sx={{ color: Colors.PRIMARY }} />
                    )}
                </DiagramContainer>
            </CellDiagramContext>
        </Container>
    );
}
