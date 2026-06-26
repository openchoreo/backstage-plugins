import { DiagramModel, PointModel } from "@projectstorm/react-diagrams-core";
import * as dagre from "dagre";
import * as _ from "lodash";
import { GraphLabel } from "dagre";
import { Point } from "@projectstorm/geometry";
import { BORDER_GAP, COMPONENT_CIRCLE_WIDTH, COMPONENT_NODE, DIAGRAM_END, EMPTY_NODE, MAIN_CELL } from "../constants";

export interface DagreEngineOptions {
    graph?: GraphLabel;
    /**
     * Will also layout links
     */
    includeLinks?: boolean;
}

export class DagreEngine {
    options: DagreEngineOptions;

    constructor(options: DagreEngineOptions = {}) {
        this.options = options;
    }

    redistribute(model: DiagramModel) {
        // Create a new directed graph
        const g = new dagre.graphlib.Graph({
            multigraph: true,
            compound: true,
        });
        g.setGraph(this.options.graph || {});
        g.setDefaultEdgeLabel(() => {
            return {};
        });
        // Create a new unlinked node paths
        const ug = new dagre.graphlib.Graph({
            multigraph: true,
            compound: true,
        });
        ug.setGraph(this.options.graph || {});

        // set nodes
        _.forEach(model.getNodes(), (node) => {
            const ports = {
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
            };
            // Count the number of links on each side of the node
            _.forEach(node.getPorts(), (port) => {
                if (port.getOptions().alignment === "top") {
                    ports.top = _.size(port.getLinks());
                } else if (port.getOptions().alignment === "bottom") {
                    ports.bottom = _.size(port.getLinks());
                } else if (port.getOptions().alignment === "left") {
                    ports.left = _.size(port.getLinks());
                } else if (port.getOptions().alignment === "right") {
                    ports.right = _.size(port.getLinks());
                }
            });

            // Check if the node is of type EMPTY_NODE
            if (node.getType() === EMPTY_NODE) {
                // If it's an EMPTY_NODE, set its position as fixed
                g.setNode(node.getID(), {
                    label: node.getID(),
                    width: node.width,
                    height: node.height,
                    x: node.getX(),
                    y: node.getY(),
                    fixed: true,
                });
            } else if (this.isLinkedNode(ports)) {
                // For other nodes, set the default position
                g.setNode(node.getID(), { label: node.getID(), width: node.width, height: node.height, ports, node });
            } else {
                // For nodes without any links, set their position in the unlinked graph
                ug.setNode(node.getID(), { label: node.getID(), width: node.width, height: node.height, node });
            }
        });

        // set node parents
        const mainCell = g.node(MAIN_CELL);
        if (mainCell) {
            _.forEach(model.getNodes(), (node) => {
                if (node.getType() === COMPONENT_NODE) {
                    g.setParent(node.getID(), MAIN_CELL);
                }
            });
        }

        _.forEach(model.getLinks(), (link) => {
            // set edges
            if (link.getSourcePort() && link.getTargetPort()) {
                g.setEdge({
                    v: link.getSourcePort().getNode().getID(),
                    w: link.getTargetPort().getNode().getID(),
                    name: link.getID(),
                });
            }
        });

        const space = BORDER_GAP * 2;
        dagre.layout(g);
        this.angleLayout(g, space);
        // get layout edge
        const { x, y } = this.getRightTopConnerOfGraph(g);
        this.arrangeInGridLayout(ug.nodes(), ug, space, x, y);
        // merge two graphs
        ug.nodes().forEach((v) => {
            g.setNode(v, ug.node(v));
        });

        g.nodes().forEach((v) => {
            const node = g.node(v);
            // Only update positions for non-EMPTY_NODE type nodes
            if (model.getNode(v).getType() !== EMPTY_NODE) {
                model.getNode(v).setPosition(node.x - node.width / 2, node.y - node.height / 2);
            }
        });

        // also include links?
        if (this.options.includeLinks) {
            g.edges().forEach((e) => {
                const edge = g.edge(e);
                const link = model.getLink(e.name as string);

                const points = [link.getFirstPoint()];
                for (let i = 1; i < edge.points.length - 1; i++) {
                    points.push(
                        new PointModel({ link: link, position: new Point(edge.points[i].x, edge.points[i].y) })
                    );
                }
                link.setPoints(points.concat(link.getLastPoint()));
            });
        }
    }

    gridLayout(g: dagre.graphlib.Graph, spacing: number) {
        const nodes = g.nodes();
        this.arrangeInGridLayout(nodes, g, spacing);
    }

    // nodes are all layout in vertical line. this method will add horizontal spacing between nodes to align nodes in angle line
    angleLayout(g: dagre.graphlib.Graph, spacing: number) {
        const nodes = g.nodes();
        let lastX = 0;

        nodes.forEach((v: string) => {
            const node = g.node(v) as dagre.Node & {
                ports?: { top: number; bottom: number; left: number; right: number };
            };
            // node only has top connection will be arranged
            if (
                node.ports &&
                node.ports.top > 0 &&
                node.ports.bottom === 0 &&
                node.ports.left >= 0 &&
                node.ports.right === 0
            ) {
                if (lastX === 0) {
                    lastX = node.x;
                } else {
                    lastX += node.width + spacing;
                    node.x = lastX;
                }
            }
        });
    }

    isLinkedNode(ports: { top: number; bottom: number; left: number; right: number }) {
        return ports.top > 0 || ports.bottom > 0 || ports.left > 0 || ports.right > 0;
    }

    arrangeInGridLayout(nodes: string[], g: dagre.graphlib.Graph, spacing: number, startX = 0, startY = 0) {
        const gridSize = Math.ceil(Math.sqrt(nodes.length));
        const minWidth = COMPONENT_CIRCLE_WIDTH + BORDER_GAP;
        let x = 0;
        let y = 0;

        nodes.forEach((v) => {
            const node = g.node(v);
            const space = minWidth + spacing;
            node.x = startX + x * space + (space - minWidth) / 2;
            node.y = startY + y * space;
            x++;
            if (x >= gridSize) {
                x = 0;
                y++;
            }
        });
    }

    getRightTopConnerOfGraph(g: dagre.graphlib.Graph) {
        let maxX = 0;
        let minY = DIAGRAM_END;
        g.nodes().forEach((v: string) => {
            const node = g.node(v);
            if (node.x > maxX) {
                maxX = node.x;
            }
            if (node.y < minY) {
                minY = node.y;
            }
        });
        if (maxX !== 0) {
            maxX += COMPONENT_CIRCLE_WIDTH * 2;
        }
        return { x: maxX, y: minY };
    }
}
