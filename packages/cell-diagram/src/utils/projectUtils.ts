import { DiagramModel, NodeModel, NodeModelGenerics, PortModelAlignment } from "@projectstorm/react-diagrams";
import { BaseModel, BaseModelGenerics } from "@projectstorm/react-canvas-core";
import {
    ComponentLinkModel,
    ComponentModel,
    ComponentPortModel,
    CellLinkModel,
    CellPortModel,
    ExternalLinkModel,
    ExternalModel,
    EmptyModel,
    ConnectionModel,
    ConnectionPortModel,
} from "../components";
import {
    CommonModel,
    Connection,
    ConnectionMetadata,
    ConnectionType,
    ConnectorMetadata,
    ProjectDiagramData,
    Project,
    ComponentMetadata,
    Observations,
    Gateways,
    ObservationSummary,
    ComponentType,
} from "../types";
import { CellBounds } from "../components/Cell/CellNode/CellModel";
import { getNodePortId, getCellPortMetadata, getCellLinkName } from "../components/Cell/cell-util";
import {
    BORDER_GAP,
    BORDER_NODE,
    CIRCLE_WIDTH,
    COMPONENT_NODE,
    CONNECTION_NODE,
    DIAGRAM_END,
    DOT_WIDTH,
    LINE_MIN_WIDTH,
    MAIN_CELL,
    MAIN_CELL_DEFAULT_HEIGHT,
} from "../resources";
import { Orientation } from "../components/Connection/ConnectionNode/ConnectionModel";
import {
    getComponentNameById,
    getComponentName,
    getComponentLinkName,
} from "../components/Component/component-node-util";
import { getConnectionNameById } from "../components/Connection/connection-node-util";
import { getEmptyNodeName } from "../components/Cell/cell-util";
import { getExternalLinkName, getExternalNodeName } from "../components/External/external-node-util";
import { DagreEngine } from "../resources/Dagre/DagreEngine";

// Project diagram engine utils
export function getDiagramDataFromProject(project: Project): ProjectDiagramData {
    const componentNodes: Map<string, CommonModel> = generateComponentNodes(project);
    const connectorNodes: Map<string, ConnectionModel> = generateConnectorNodes(project);
    const connectionNodes: Map<string, ConnectionModel> = generateConnectionNodes(project);
    const externalNodes: Map<string, ExternalModel> = generateExternalNodes();
    const emptyNodes: Map<string, EmptyModel> = generateEmptyNodes(project.name, [
        ...connectionNodes.values(),
        ...connectorNodes.values(),
    ]);
    const gateways = getCellGateways(project);
    const observationSummary = getObservationSummary(project);

    const componentLinks: Map<string, ComponentLinkModel> = generateComponentLinks(project, componentNodes);
    const cellLinks: Map<string, ComponentLinkModel> = generateCellLinks(project, emptyNodes, componentNodes);
    const connectorLinks: Map<string, ExternalLinkModel> = generateConnectorLinks(emptyNodes, connectorNodes);
    const connectionLinks: Map<string, ExternalLinkModel> = generateConnectionLinks(emptyNodes, connectionNodes);
    const externalLinks: Map<string, ExternalLinkModel> = generateExternalLinks(emptyNodes, externalNodes, gateways);
    const externalConnectionLinks: Map<string, ExternalLinkModel> = generateExternalConnectionLinks(
        project,
        componentNodes,
        connectionNodes
    );

    return {
        nodes: {
            componentNodes,
            connectionNodes,
            connectorNodes,
            externalNodes,
            emptyNodes,
        },
        links: {
            componentLinks,
            cellLinks,
            connectorLinks,
            connectionLinks,
            externalLinks,
            externalConnectionLinks,
        },
        gateways,
        observationSummary,
    };
}

// Cell utils

export function getComponentDiagramWidth(models: ProjectDiagramData): number {
    const tempModel = new DiagramModel();
    tempModel.addAll(
        ...models.nodes.componentNodes.values(),
        ...models.links.componentLinks.values(),
        ...models.nodes.emptyNodes.values(),
        ...models.links.cellLinks.values()
    );
    // auto distribute component nodes, component links, empty nodes and cell links
    const dagreEngine = new DagreEngine({
        graph: {
            rankdir: "LR",
            ranksep: 200,
            edgesep: 100,
            nodesep: 150,
            ranker: "tight-tree",
        },
    });
    dagreEngine.redistribute(tempModel);
    // calculate component diagram width
    return calculateCellWidth(tempModel);
}

export function getComponentDiagramBoundaries(model: DiagramModel) {
    let minX = DIAGRAM_END;
        let minY = DIAGRAM_END;
        let maxX = 0;
        let maxY = 0;
    model.getNodes().forEach((node) => {
        if (!isRenderInsideCell(node)) {
            return;
        }
        const nodePosition = node.getPosition().clone();
        minX = Math.min(minX, nodePosition.x);
        minY = Math.min(minY, nodePosition.y);
        maxX = Math.max(maxX, nodePosition.x + node.width);
        maxY = Math.max(maxY, nodePosition.y + node.height);
    });
    return { maxX, minX, maxY, minY };
}

export function calculateCellWidth(model: DiagramModel) {
    const { maxX, minX, maxY, minY } = getComponentDiagramBoundaries(model);
    const layoutWidth = Math.max(maxX - minX, maxY - minY, MAIN_CELL_DEFAULT_HEIGHT);
    const cellWidth = (layoutWidth * 3) / 2;
    return cellWidth;
}

// Node distribution utils

export function manualDistribute(model: DiagramModel): DiagramModel {
    // get component diagram boundaries and calculate center
    const { maxX, minX, maxY, minY } = getComponentDiagramBoundaries(model);
    const layoutCenterX = (maxX + minX) / 2;
    const layoutCenterY = (maxY + minY) / 2;
    const cellNode = model.getNode(MAIN_CELL);
    if (!cellNode) {
        return model;
    }
    const cellWidth = cellNode.width;
    // center cell node
    const cellNodePosition = cellNode.getPosition().clone();
    cellNodePosition.x = layoutCenterX - cellWidth / 2;
    cellNodePosition.y = layoutCenterY - cellWidth / 2;
    cellNode.setPosition(cellNodePosition);
    // update empty node and connection node positions
    updateBoundNodePositions(cellNode, model);

    return model;
}

export function updateBoundNodePositions(cellNode: NodeModel<NodeModelGenerics>, model: DiagramModel) {
    const externalLinkOffset = Math.max(100, cellNode.width / 10);
    let nextConnectorNodeOffset = externalLinkOffset;

    let externalConsumerOffset = 0;
    // Position external consumer components
    model.getNodes().forEach((node) => {
        if (node instanceof ComponentModel && node.isExternalConsumer()) {
            const cellPosition = cellNode.getPosition();
            node.setPosition(cellPosition.x - 200 - externalConsumerOffset, cellPosition.y - 200);
            externalConsumerOffset += node.width + 50; // Add some spacing between external consumers
        }
    });

    for (const key in cellNode.getPorts()) {
        if (Object.prototype.hasOwnProperty.call(cellNode.getPorts(), key)) {
            const port = cellNode.getPorts()[key];
            const { bound, align, args } = getCellPortMetadata(port.getID());
            if (!bound || !align) {
                return;
            }
            const connectionId = args?.length > 0 ? args[0] : undefined;
            // change south bound positions
            if (bound === CellBounds.SouthBound && align === PortModelAlignment.BOTTOM) {
                const portPosition = port.getPosition().clone();
                // change connection link positions
                const connectionNode = model.getNode(getConnectionNameById(connectionId as string));
                const defaultNodeWidth = CIRCLE_WIDTH + 24; // padding + circle border width
                if (connectionNode) {
                    portPosition.x = portPosition.x - connectionNode.width / 2;
                    portPosition.y = portPosition.y + nextConnectorNodeOffset;
                    connectionNode.setPosition(portPosition);
                    // if connection node width is greater than cell node width, next connection node should be placed below the previous one
                    if (
                        nextConnectorNodeOffset === externalLinkOffset &&
                        connectionNode.width > defaultNodeWidth
                    ) {
                        nextConnectorNodeOffset = externalLinkOffset + connectionNode.height;
                    } else {
                        nextConnectorNodeOffset = externalLinkOffset;
                    }
                }
            }
            if (connectionId && bound === CellBounds.SouthBound && align === PortModelAlignment.TOP) {
                const portPosition = port.getPosition().clone();
                // change south bound empty node position
                model.getNode(getEmptyNodeName(CellBounds.SouthBound, connectionId)).setPosition(portPosition);
            }
            // change east bound positions
            if (connectionId && bound === CellBounds.EastBound && align === PortModelAlignment.RIGHT) {
                const portPosition = port.getPosition().clone();
                // change east bound external link position
                const connectionNode = model.getNode(getConnectionNameById(connectionId));
                if (connectionNode) {
                    portPosition.x = portPosition.x + externalLinkOffset;
                    portPosition.y = portPosition.y - connectionNode.height / 2 + 7.5;
                    connectionNode.setPosition(portPosition);
                }
            }
            if (connectionId && bound === CellBounds.EastBound && align === PortModelAlignment.LEFT) {
                const portPosition = port.getPosition().clone();
                // change east bound empty node position
                model.getNode(getEmptyNodeName(CellBounds.EastBound, connectionId)).setPosition(portPosition);
            }
            // change west bound external link position
            if (bound === CellBounds.WestBound && align === PortModelAlignment.LEFT) {
                // change west bound empty node position
                const nodePosition = port.getPosition().clone();
                nodePosition.x = nodePosition.x - LINE_MIN_WIDTH * 2;
                model.getNode(getEmptyNodeName(CellBounds.WestBound)).setPosition(nodePosition);
                // change west bound external link position
                const portPosition = port.getPosition().clone();
                portPosition.x = portPosition.x - externalLinkOffset;
                model.getNode(getExternalNodeName(bound))?.setPosition(portPosition);
            }
            // change north bound positions
            if (bound === CellBounds.NorthBound && align === PortModelAlignment.TOP) {
                // change north bound empty node position
                const nodePosition = port.getPosition().clone();
                nodePosition.y = nodePosition.y - LINE_MIN_WIDTH * 2;
                model.getNode(getEmptyNodeName(CellBounds.NorthBound)).setPosition(nodePosition);
                // change north bound external link position
                const portPosition = port.getPosition().clone();
                portPosition.y = portPosition.y - externalLinkOffset;
                model.getNode(getExternalNodeName(bound))?.setPosition(portPosition);
            }
        }
    }
    // arrange border nodes
    // change north bound border empty node position
    const cellPositionNorth = cellNode.getPosition().clone();
    cellPositionNorth.y = cellPositionNorth.y - (externalLinkOffset + CIRCLE_WIDTH / 2) - BORDER_GAP;
    model.getNode(getEmptyNodeName(CellBounds.NorthBound, BORDER_NODE))?.setPosition(cellPositionNorth.clone());
    // change south bound border empty node position
    const cellPositionSouth = cellNode.getPosition().clone();
    cellPositionSouth.y = cellPositionSouth.y + (cellNode.width - CIRCLE_WIDTH) + BORDER_GAP;
    model.getNode(getEmptyNodeName(CellBounds.SouthBound, BORDER_NODE))?.setPosition(cellPositionSouth.clone());
}

export function isRenderInsideCell(node: BaseModel<BaseModelGenerics>): boolean {
    return (
        (node.getType() === COMPONENT_NODE && !(node as ComponentModel).isExternalConsumer()) ||
        (node.getType() === CONNECTION_NODE &&
            isConnectorConnection((node as ConnectionModel).connection) &&
            !!(node as ConnectionModel).connection.onPlatform)
    );
}

// Node generation utils

function generateComponentNodes(project: Project): Map<string, CommonModel> {
    const nodes: Map<string, CommonModel> = new Map<string, ComponentModel>();
    project.components?.forEach((component, _key) => {
        const componentNode = new ComponentModel(component);
        nodes.set(componentNode.getID(), componentNode);
        component.connections?.forEach((connection) => {
            // add platform connections
            if (isConnectorConnection(connection) && connection.onPlatform) {
                const connectionNode = new ConnectionModel(connection);
                nodes.set(connectionNode.getID(), connectionNode);
            }
        });
    });
    project.configurations?.forEach((connection, _key) => {
        if (isConnectorConnection(connection) && connection.onPlatform) {
            const connectionNode = new ConnectionModel(connection);
            nodes.set(connectionNode.getID(), connectionNode);
        }
    });

    return nodes;
}

function generateConnectionNodes(project: Project): Map<string, ConnectionModel> {
    const nodes: Map<string, ConnectionModel> = new Map<string, ConnectionModel>();
    project.components?.forEach((component, _key) => {
        component.connections?.forEach((connection) => {
            if (isExternalConnection(project.id, connection, true)) {
                // Skip platform check for org level connections
                const connectionNode = new ConnectionModel(connection, Orientation.HORIZONTAL);
                nodes.set(connectionNode.getID(), connectionNode);
            }
        });
    });

    return nodes;
}

function generateConnectorNodes(project: Project): Map<string, ConnectionModel> {
    const nodes: Map<string, ConnectionModel> = new Map<string, ConnectionModel>();
    project.components?.forEach((component, _key) => {
        component.connections?.forEach((connection) => {
            if (isConnectorConnection(connection) && !connection.onPlatform) {
                const connectionNode = new ConnectionModel(connection);
                nodes.set(connectionNode.getID(), connectionNode);
            }
        });
    });
    project.configurations?.forEach((connection, _key) => {
        if (isConnectorConnection(connection) && !connection.onPlatform) {
            const connectionNode = new ConnectionModel(connection);
            nodes.set(connectionNode.getID(), connectionNode);
        }
    });

    return nodes;
}

function generateExternalNodes(): Map<string, ExternalModel> {
    const nodes: Map<string, ExternalModel> = new Map<string, ExternalModel>();

    const northBoundExternalNode = new ExternalModel(CellBounds.NorthBound);
    nodes.set(northBoundExternalNode.getID(), northBoundExternalNode);

    const westBoundExternalNode = new ExternalModel(CellBounds.WestBound);
    nodes.set(westBoundExternalNode.getID(), westBoundExternalNode);

    return nodes;
}

function generateEmptyNodes(projectId: string, connectionNodes: ConnectionModel[]): Map<string, EmptyModel> {
    const nodes: Map<string, EmptyModel> = new Map<string, EmptyModel>();

    const northBoundEmptyNode = new EmptyModel(CellBounds.NorthBound, CIRCLE_WIDTH + LINE_MIN_WIDTH * 4);
    northBoundEmptyNode.setPosition(0, DIAGRAM_END * -1);
    nodes.set(northBoundEmptyNode.getID(), northBoundEmptyNode);

    const westBoundEmptyNode = new EmptyModel(CellBounds.WestBound, CIRCLE_WIDTH + LINE_MIN_WIDTH * 4);
    westBoundEmptyNode.setPosition(DIAGRAM_END * -1, 0);
    nodes.set(westBoundEmptyNode.getID(), westBoundEmptyNode);

    let count = 0;
    connectionNodes.forEach((connectionNode, _key) => {
        if (isConnectorConnection(connectionNode.connection)) {
            const connectionEmptyNode = new EmptyModel(CellBounds.SouthBound, DOT_WIDTH, connectionNode.connection.id);
            connectionEmptyNode.setPosition(count++ * 30, DIAGRAM_END);
            nodes.set(connectionEmptyNode.getID(), connectionEmptyNode);
        } else if (isExternalConnection(projectId, connectionNode.connection, true)) {
            const connectionEmptyNode = new EmptyModel(CellBounds.EastBound, DOT_WIDTH, connectionNode.connection.id);
            connectionEmptyNode.setPosition(DIAGRAM_END, count++ * 30);
            nodes.set(connectionEmptyNode.getID(), connectionEmptyNode);
        }
    });

    // add border empty nodes
    const northBoundBorderEmptyNode = new EmptyModel(CellBounds.NorthBound, CIRCLE_WIDTH, BORDER_NODE);
    nodes.set(northBoundBorderEmptyNode.getID(), northBoundBorderEmptyNode);

    const southBoundBorderEmptyNode = new EmptyModel(CellBounds.SouthBound, CIRCLE_WIDTH, BORDER_NODE);
    nodes.set(southBoundBorderEmptyNode.getID(), southBoundBorderEmptyNode);

    return nodes;
}

function getCellGateways(project: Project): Gateways {
    const gateways = {
        internet: false,
        intranet: false,
    };

    project.components?.forEach((component, _key) => {
        for (const serviceId in component.services) {
            if (Object.prototype.hasOwnProperty.call(component.services, serviceId)) {
                const service = component.services[serviceId];
                // add platform connections
                if (service.deploymentMetadata?.gateways.internet.isExposed) {
                    gateways.internet = true;
                }
                if (service.deploymentMetadata?.gateways.intranet.isExposed) {
                    gateways.intranet = true;
                }
            }
        }
    });

    return gateways;
}

function getObservationSummary(project: Project): ObservationSummary {
    let maxRequestCount = 0;
    let minRequestCount = Infinity;

    const calculateRequestCount = (observations: Observations[] | undefined) => {
        if (observations && observations.length > 0) {
            const requestCount = observations.reduce((acc, obs) => acc + obs.requestCount, 0);
            if (requestCount > maxRequestCount) {
                maxRequestCount = requestCount;
            }
            if (requestCount < minRequestCount) {
                minRequestCount = requestCount;
            }
        }
    };

    project.components?.forEach((component, _key) => {
        for (const serviceId in component.services) {
            if (Object.prototype.hasOwnProperty.call(component.services, serviceId)) {
                const service = component.services[serviceId];
                calculateRequestCount(service.deploymentMetadata?.gateways.internet.observations);
                calculateRequestCount(service.deploymentMetadata?.gateways.intranet.observations);
            }
        }
        if (component.connections.length > 0) {
            component.connections.forEach((connection) => {
                calculateRequestCount(connection.observations);
            });
        }
    });
    // Set min request count to 0 since all requests are not captured in Observations
    return { requestCount: { max: maxRequestCount, min: 0 } };
}

// Links generation utils

function generateComponentLinks(project: Project, nodes: Map<string, CommonModel>): Map<string, ComponentLinkModel> {
    const links: Map<string, ComponentLinkModel> = new Map();

    project.components?.forEach((component, _key) => {
        // skip generating component links for external consumer components
        if (component.type === ComponentType.EXTERNAL_CONSUMER) {
            return;
        }
        const componentId = getComponentName(component);
        const callingComponent: ComponentModel | undefined = nodes.get(componentId) as ComponentModel;

        component.connections.forEach((connection) => {
            const connectionMetadata = getConnectionMetadata(connection);
            if (
                connectionMetadata &&
                !isConnectorConnection(connection) &&
                isInternalComponent(project.id, connection)
            ) {
                const associatedComponent = nodes.get(
                    getComponentNameById((connectionMetadata as ComponentMetadata).component)
                ) as ComponentModel;
                if (callingComponent && associatedComponent) {
                    const sourcePort: ComponentPortModel | null = callingComponent.getPort(
                        `right-${callingComponent.getID()}`
                    );
                    const targetPort: ComponentPortModel | null = associatedComponent.getPort(
                        `left-${associatedComponent.getID()}`
                    );

                    if (sourcePort && targetPort) {
                        const linkId = getComponentLinkName(sourcePort.getID(), targetPort.getID());
                        const link: ComponentLinkModel = new ComponentLinkModel(linkId);
                        links.set(linkId, createLinks(sourcePort, targetPort, link) as ComponentLinkModel);
                        link.setSourceNode(callingComponent.getID());
                        link.setTargetNode(associatedComponent.getID());
                        if (connection.observations && connection.observations.length > 0) {
                            link.setObservations(connection.observations, connection.observationOnly);
                        }
                        if (connection.tooltip) {
                            link.setTooltip(connection.tooltip);
                        }
                    }
                }
            }
            if (isConnectorConnection(connection) && connection.onPlatform) {
                const associatedComponent = nodes.get(getConnectionNameById(connection.id)) as ConnectionModel;
                if (callingComponent && associatedComponent) {
                    const sourcePort: ComponentPortModel | null = callingComponent.getPort(
                        `bottom-${callingComponent.getID()}`
                    );
                    const targetPort: ConnectionPortModel | null = associatedComponent.getPort(
                        `top-${associatedComponent.getID()}`
                    );

                    if (sourcePort && targetPort) {
                        const linkId = getComponentLinkName(sourcePort.getID(), targetPort.getID());
                        const link: ComponentLinkModel = new ComponentLinkModel(linkId);
                        links.set(linkId, createLinks(sourcePort, targetPort, link) as ComponentLinkModel);
                        link.setSourceNode(callingComponent.getID());
                        link.setTargetNode(associatedComponent.getID());
                        if (connection.observations && connection.observations.length > 0) {
                            link.setObservations(connection.observations, connection.observationOnly);
                        }
                        if (connection.tooltip) {
                            link.setTooltip(connection.tooltip);
                        }
                    }
                }
            }
        });
    });

    return links;
}

function generateConnectorLinks(
    emptyNodes: Map<string, EmptyModel>,
    connectorNodes: Map<string, ConnectionModel>
): Map<string, ExternalLinkModel> {
    const links: Map<string, ExternalLinkModel> = new Map();

    connectorNodes?.forEach((connectionNode, _key) => {
        const southBoundEmptyNode = emptyNodes.get(
            getEmptyNodeName(CellBounds.SouthBound, connectionNode.connection.id)
        );
        if (!southBoundEmptyNode) {
            return;
        }
        const sourcePort: CellPortModel | null = southBoundEmptyNode.getPort(
            getNodePortId(southBoundEmptyNode.getID(), PortModelAlignment.BOTTOM)
        );
        const targetPort: ConnectionPortModel | null = connectionNode.getPort(`top-${connectionNode.getID()}`);

        if (sourcePort && targetPort) {
            const linkId = getExternalLinkName(sourcePort.getID(), targetPort.getID());
            const link: ExternalLinkModel = new ExternalLinkModel(linkId);
            links.set(linkId, createLinks(sourcePort, targetPort, link) as ExternalLinkModel);
            link.setSourceNode(southBoundEmptyNode.getID());
            link.setTargetNode(connectionNode.getID());
        }
    });

    return links;
}

function generateConnectionLinks(
    emptyNodes: Map<string, EmptyModel>,
    connectionNodes: Map<string, ConnectionModel>
): Map<string, ExternalLinkModel> {
    const links: Map<string, ExternalLinkModel> = new Map();

    connectionNodes?.forEach((connectionNode, _key) => {
        const eastboundEmptyNode = emptyNodes.get(getEmptyNodeName(CellBounds.EastBound, connectionNode.connection.id));
        if (!eastboundEmptyNode) {
            return;
        }
        const sourcePort: CellPortModel | null = eastboundEmptyNode.getPort(
            getNodePortId(eastboundEmptyNode.getID(), PortModelAlignment.RIGHT)
        );
        const targetPort: ConnectionPortModel | null = connectionNode.getPort(`left-${connectionNode.getID()}`);

        if (sourcePort && targetPort) {
            const linkId = getExternalLinkName(sourcePort.getID(), targetPort.getID());
            const link: ExternalLinkModel = new ExternalLinkModel(linkId);
            links.set(linkId, createLinks(sourcePort, targetPort, link) as ExternalLinkModel);
            link.setSourceNode(eastboundEmptyNode.getID());
            link.setTargetNode(connectionNode.getID());
        }
    });

    return links;
}

function generateCellLinks(
    project: Project,
    emptyNodes: Map<string, EmptyModel>,
    nodes: Map<string, CommonModel>
): Map<string, CellLinkModel> {
    const links: Map<string, CellLinkModel> = new Map();

    project.components?.forEach((component, _key) => {
        const componentId = getComponentName(component);
        const targetComponent: ComponentModel | undefined = nodes.get(componentId) as ComponentModel;
        // internet/public exposed services links
        if (targetComponent) {
            let isExposed = false;
            let tooltip = "";
            const observations: Observations[] = [];
            let observationOnly = false;
            for (const serviceId in component.services) {
                if (Object.prototype.hasOwnProperty.call(component.services, serviceId)) {
                    const service = component.services[serviceId];
                    const internet = service.deploymentMetadata?.gateways.internet;
                    isExposed = isExposed || !!internet?.isExposed;
                    // capture service exposed link observations
                    if (internet?.observations && internet.observations.length > 0) {
                        observations.push(
                            ...internet.observations.map((obs) => {
                                if (service.label) {
                                    obs.label = service.label;
                                }
                                return obs;
                            })
                        );
                        observationOnly = observationOnly || !!internet?.observationOnly;
                    }
                    tooltip = internet?.tooltip ?? "";
                }
            }
            const northBoundEmptyNode = emptyNodes.get(getEmptyNodeName(CellBounds.NorthBound));
            if (isExposed && northBoundEmptyNode) {
                const sourcePort: CellPortModel | null = northBoundEmptyNode.getPort(
                    getNodePortId(northBoundEmptyNode.getID(), PortModelAlignment.BOTTOM)
                );
                const targetPort: ComponentPortModel | null = targetComponent.getPort(`top-${targetComponent.getID()}`);
                if (sourcePort && targetPort) {
                    const linkId = getCellLinkName(sourcePort.getID(), targetPort.getID());
                    const link: CellLinkModel = new CellLinkModel(linkId);
                    links.set(linkId, createLinks(sourcePort, targetPort, link) as CellLinkModel);
                    link.setSourceNode(northBoundEmptyNode.getID());
                    link.setTargetNode(targetComponent.getID());
                    if (observations?.length > 0) {
                        link.setObservations(observations, observationOnly);
                    }
                    if (tooltip) {
                        link.setTooltip(tooltip);
                    }
                }
            }
        }
        // intranet/org exposed services links
        if (targetComponent) {
            let isExposed = false;
            let tooltip = "";
            const observations: Observations[] = [];
            let observationOnly = false;
            for (const serviceId in component.services) {
                if (Object.prototype.hasOwnProperty.call(component.services, serviceId)) {
                    const service = component.services[serviceId];
                    const intranet = service.deploymentMetadata?.gateways.intranet;
                    isExposed = isExposed || !!intranet?.isExposed;
                    // capture service exposed link observations
                    if (intranet?.observations && intranet.observations.length > 0) {
                        observations.push(...intranet.observations);
                    }
                    observationOnly = observationOnly || !!intranet?.observationOnly;
                    tooltip = intranet?.tooltip ?? "";
                }
            }
            const northBoundEmptyNode = emptyNodes.get(getEmptyNodeName(CellBounds.WestBound));
            if (isExposed && northBoundEmptyNode) {
                const sourcePort: CellPortModel | null = northBoundEmptyNode.getPort(
                    getNodePortId(northBoundEmptyNode.getID(), PortModelAlignment.RIGHT)
                );
                const targetPort: ComponentPortModel | null = targetComponent.getPort(
                    `left-${targetComponent.getID()}`
                );
                if (sourcePort && targetPort) {
                    const linkId = getCellLinkName(sourcePort.getID(), targetPort.getID());
                    const link: CellLinkModel = new CellLinkModel(linkId);
                    links.set(linkId, createLinks(sourcePort, targetPort, link) as CellLinkModel);
                    link.setSourceNode(northBoundEmptyNode.getID());
                    link.setTargetNode(targetComponent.getID());
                    if (observations.length > 0) {
                        link.setObservations(observations, observationOnly);
                    }
                    if (tooltip) {
                        link.setTooltip(tooltip);
                    }
                }
            }
        }
        // connection links
        component.connections.forEach((connection) => {
            if (isConnectorConnection(connection)) {
                const southBoundEmptyNode = emptyNodes.get(getEmptyNodeName(CellBounds.SouthBound, connection.id));
                if (targetComponent && southBoundEmptyNode) {
                    const sourcePort: ComponentPortModel | null = targetComponent.getPort(
                        `bottom-${targetComponent.getID()}`
                    );
                    const targetPort: CellPortModel | null = southBoundEmptyNode.getPort(
                        getNodePortId(southBoundEmptyNode.getID(), PortModelAlignment.TOP)
                    );

                    if (sourcePort && targetPort) {
                        const linkId = getCellLinkName(sourcePort.getID(), targetPort.getID());
                        const link: CellLinkModel = new CellLinkModel(linkId);
                        links.set(linkId, createLinks(sourcePort, targetPort, link) as CellLinkModel);
                        link.setSourceNode(targetComponent.getID());
                        link.setTargetNode(southBoundEmptyNode.getID());
                        if (connection.observations && connection.observations.length > 0) {
                            link.setObservations(connection.observations, connection.observationOnly);
                        }
                        if (connection.tooltip) {
                            link.setTooltip(connection.tooltip);
                        }
                    }
                }
            } else if (isExternalConnection(project.id, connection, true)) {
                if (targetComponent && targetComponent.isExternalConsumer()) {
                    // Skip external consumer connections and handle them separately
                    return;
                }
                const eastBoundEmptyNode = emptyNodes.get(getEmptyNodeName(CellBounds.EastBound, connection.id));
                if (targetComponent && eastBoundEmptyNode) {
                    const sourcePort: ComponentPortModel | null = targetComponent.getPort(
                        `right-${targetComponent.getID()}`
                    );
                    const targetPort: CellPortModel | null = eastBoundEmptyNode.getPort(
                        getNodePortId(eastBoundEmptyNode.getID(), PortModelAlignment.LEFT)
                    );

                    if (sourcePort && targetPort) {
                        const linkId = getCellLinkName(sourcePort.getID(), targetPort.getID());
                        const link: CellLinkModel = new CellLinkModel(linkId);
                        links.set(linkId, createLinks(sourcePort, targetPort, link) as CellLinkModel);
                        link.setSourceNode(targetComponent.getID());
                        link.setTargetNode(eastBoundEmptyNode.getID());
                        if (connection.observations && connection.observations.length > 0) {
                            link.setObservations(connection.observations, connection.observationOnly);
                        }
                        if (connection.tooltip) {
                            link.setTooltip(connection.tooltip);
                        }
                    }
                }
            }
        });
        // external consumer connections
        if (targetComponent && targetComponent.isExternalConsumer()) {
            for (const connection of component.connections) {
                let targetEmptyNode: EmptyModel | null = null;
                let targetBound: CellBounds | null = null;
                let destinationComponentNode: ComponentModel | null = null;
                const metadata = getConnectionMetadata(connection) as ComponentMetadata;
                for (const cmp of project.components) {
                    if (cmp.id === metadata.component) {
                        destinationComponentNode = nodes.get(getComponentName(cmp)) as ComponentModel;
                        // If any service is exposed to internet, set targetBound to NorthBound, else to WestBound
                        // This is due to a limit in current model to track individual services by connection ID
                        const services = Object.values(cmp.services);
                        targetBound = CellBounds.WestBound; // Default to WestBound
                        for (const service of services) {
                            if (service.deploymentMetadata?.gateways.internet.isExposed) {
                                targetBound = CellBounds.NorthBound;
                                break; // Exit the loop once we find an internet-exposed service
                            }
                        }
                    }
                }
                if (targetBound) {
                    targetEmptyNode = emptyNodes.get(getEmptyNodeName(targetBound)) ?? null;
                }
                if (targetEmptyNode) {
                    // create cell gateway connection for external consumer
                    const sourcePort: ComponentPortModel | null = targetComponent.getPort(
                        `bottom-${targetComponent.getID()}`
                    );
                    const targetPort: CellPortModel | null = targetEmptyNode.getPort(
                        getNodePortId(
                            targetEmptyNode.getID(),
                            targetBound === CellBounds.NorthBound ? PortModelAlignment.TOP : PortModelAlignment.LEFT
                        )
                    );
                    if (sourcePort && targetPort) {
                        const linkId = getCellLinkName(sourcePort.getID(), targetPort.getID());
                        const link: CellLinkModel = new CellLinkModel(linkId);
                        link.setSourceNode(targetComponent.getID());
                        link.setTargetNode(targetEmptyNode.getID());
                        link.setIsExternalConsumerLink(true);
                        link.setDestinationNode(destinationComponentNode as ComponentModel);
                        links.set(linkId, createLinks(sourcePort, targetPort, link) as CellLinkModel);
                    }
                }
            }
        }
    });

    return links;
}

function generateExternalLinks(
    emptyNodes: Map<string, EmptyModel>,
    externalNodes: Map<string, ExternalModel>,
    gateways: Gateways
): Map<string, ExternalLinkModel> {
    const links: Map<string, ExternalLinkModel> = new Map();
    // East bound external node link
    const eastBoundEmptyNode = emptyNodes.get(getEmptyNodeName(CellBounds.EastBound));
    if (eastBoundEmptyNode) {
        const eastBoundLink = createExternalLink(
            eastBoundEmptyNode,
            externalNodes,
            CellBounds.EastBound,
            PortModelAlignment.RIGHT
        );
        if (eastBoundLink) {
            links.set(eastBoundLink.getID(), eastBoundLink);
        }
    }
    // North bound external node link
    const northBoundEmptyNode = emptyNodes.get(getEmptyNodeName(CellBounds.NorthBound));
    if (northBoundEmptyNode && gateways.internet) {
        const northBoundLink = createExternalLink(
            northBoundEmptyNode,
            externalNodes,
            CellBounds.NorthBound,
            PortModelAlignment.TOP,
            true
        );
        if (northBoundLink) {
            links.set(northBoundLink.getID(), northBoundLink);
        }
    }
    // West bound external node link
    const westBoundEmptyNode = emptyNodes.get(getEmptyNodeName(CellBounds.WestBound));
    if (westBoundEmptyNode && gateways.intranet) {
        const westBoundLink = createExternalLink(
            westBoundEmptyNode,
            externalNodes,
            CellBounds.WestBound,
            PortModelAlignment.LEFT,
            true
        );
        if (westBoundLink) {
            links.set(westBoundLink.getID(), westBoundLink);
        }
    }
    return links;
}

function generateExternalConnectionLinks(
    project: Project,
    nodes: Map<string, CommonModel>,
    connectionNodes: Map<string, ConnectionModel>
): Map<string, ExternalLinkModel> {
    const links: Map<string, ExternalLinkModel> = new Map();
    project.components?.forEach((component, _key) => {
        const componentId = getComponentName(component);
        const targetComponent: ComponentModel | undefined = nodes.get(componentId) as ComponentModel;
        component.connections.forEach((connection) => {
            if (
                isExternalConnection(project.id, connection, true) &&
                targetComponent &&
                targetComponent.isExternalConsumer()
            ) {
                // external consumer connections with another project components in the same organization
                const connectionNode = connectionNodes.get(getConnectionNameById(connection.id));
                if (targetComponent && connectionNode) {
                    const sourcePort: ComponentPortModel | null = targetComponent.getPort(
                        `right-${targetComponent.getID()}`
                    );
                    const targetPort: ConnectionPortModel | null = connectionNode.getPort(
                        getNodePortId(connectionNode.getID(), PortModelAlignment.LEFT)
                    );

                    if (sourcePort && targetPort) {
                        const linkId = getCellLinkName(sourcePort.getID(), targetPort.getID());
                        const link: ExternalLinkModel = new ExternalLinkModel(linkId, true);
                        links.set(linkId, createLinks(sourcePort, targetPort, link) as ExternalLinkModel);
                        link.setSourceNode(targetComponent.getID());
                        link.setTargetNode(connectionNode.getID());
                        if (connection.observations && connection.observations.length > 0) {
                            link.setObservations(connection.observations, connection.observationOnly);
                        }
                        if (connection.tooltip) {
                            link.setTooltip(connection.tooltip);
                        }
                    }
                }
            }
        });
    });
    return links;
}

function createLinks(
    sourcePort: ComponentPortModel,
    targetPort: ComponentPortModel,
    link: ComponentLinkModel | ExternalLinkModel | CellLinkModel
): ComponentLinkModel | ExternalLinkModel | CellLinkModel {
    link.setSourcePort(sourcePort);
    link.setTargetPort(targetPort);
    sourcePort.addLink(link);
    return link;
}

function createExternalLink(
    emptyNode: EmptyModel,
    externalNodes: Map<string, ExternalModel>,
    bounds: CellBounds,
    alignment: PortModelAlignment,
    switchArrow = false
) {
    const sourcePort: CellPortModel | null = emptyNode.getPort(getNodePortId(emptyNode.getID(), alignment));
    const targetNode = externalNodes.get(getExternalNodeName(bounds));
    const targetPort = targetNode?.getPort(`${getOppositeAlignment(alignment)}-${targetNode.getID()}`);

    if (sourcePort && targetNode && targetPort) {
        const linkId = getExternalLinkName(sourcePort.getID(), targetPort.getID());
        const link: ExternalLinkModel = new ExternalLinkModel(linkId);

        if (switchArrow) {
            link.setSourceNode(targetNode.getID());
            link.setTargetNode(emptyNode.getID());
            return createLinks(targetPort, sourcePort, link) as ExternalLinkModel;
        } 
            link.setSourceNode(emptyNode.getID());
            link.setTargetNode(targetNode.getID());
            return createLinks(sourcePort, targetPort, link) as ExternalLinkModel;
        
    }
    return undefined;
}

// Common utils

function getOppositeAlignment(alignment: PortModelAlignment): PortModelAlignment {
    switch (alignment) {
        case PortModelAlignment.LEFT:
            return PortModelAlignment.RIGHT;
        case PortModelAlignment.RIGHT:
            return PortModelAlignment.LEFT;
        case PortModelAlignment.TOP:
            return PortModelAlignment.BOTTOM;
        case PortModelAlignment.BOTTOM:
            return PortModelAlignment.TOP;
        default:
            return alignment;
    }
}

export function getConnectionMetadata(connection: Connection): ConnectionMetadata | null {
    const ids = connection.id.split(":");
    if (ids.length === 3) {
        return {
            type: connection.type,
            organization: ids[0],
            project: ids[1],
            component: ids[2],
        } as ComponentMetadata;
    } else if (ids.length === 4) {
        return {
            type: connection.type,
            organization: ids[0],
            project: ids[1],
            component: ids[2],
            service: ids[3],
        } as ComponentMetadata;
    } else if (isConnectorConnection(connection) && ids.length === 2) {
        return {
            type: connection.type,
            organization: ids[0],
            package: ids[1],
        } as ConnectorMetadata;
    }
    return null;
}

export function isInternalComponent(projectId: string, connection: Connection): boolean {
    const metadata = getConnectionMetadata(connection);
    return !!metadata && (metadata as ComponentMetadata).project === projectId;
}

export function isExternalConnection(projectId: string, connection: Connection, skipPlatform?: boolean): boolean {
    const metadata = getConnectionMetadata(connection);
    return Boolean(
        (!isConnectorConnection(connection) || !connection.type) && // Some connections doesn't have connection type
            (skipPlatform || !connection.onPlatform) && // Skip platform fields for some connections
            metadata &&
            (metadata as ComponentMetadata).project !== projectId
    );
}

// check is connector connection
export function isConnectorConnection(connection: Connection): boolean {
    // connector and datastore treat as connector connections
    return connection.type === ConnectionType.Connector || connection.type === ConnectionType.Datastore;
}
