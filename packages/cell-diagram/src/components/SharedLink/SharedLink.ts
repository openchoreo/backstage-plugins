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

import { DefaultLinkModel, DiagramEngine, NodeModel, PortModelAlignment } from "@projectstorm/react-diagrams";
import { BezierCurve, Point } from "@projectstorm/geometry";
import { forIn } from "lodash";
import styled from "@emotion/styled";
import { css, keyframes } from "@emotion/react";
import { EMPTY_NODE } from "../../resources";
import { EmptyModel } from "../Cell/EmptyNode/EmptyModel";
import { CellBounds } from "../Cell/CellNode/CellModel";
import { getCellPortMetadata } from "../Cell/cell-util";
import { getEmptyNodeName } from "../Cell/cell-util";
import { Observations } from "../../types";

export class SharedLinkModel extends DefaultLinkModel {
    diagramEngine!: DiagramEngine;
    observations!: Observations[];
    observationOnly!: boolean;
    tooltip!: string;

    constructor(id: string, type: string) {
        super({
            id: id,
            type: type,
        });
    }

    initLinks = (diagramEngine: DiagramEngine) => {
        this.diagramEngine = diagramEngine;
    };

    fireEventTroughLink = (event: string) => {
        const selectTargetPort = (targetNode: NodeModel, alignment: PortModelAlignment, bound: CellBounds) => {
            if (targetNode.getType() === EMPTY_NODE && (targetNode as EmptyModel).bound === bound) {
                const portMetadata = getCellPortMetadata(targetNode.getID());
                if (!portMetadata?.args) {
                    return;
                }
                const targetPort = targetNode.getPortFromID(
                    `${alignment  }-${  getEmptyNodeName(bound, ...portMetadata.args)}`
                );
                if (!targetPort) {
                    return;
                }
                forIn(targetPort.getLinks(), (link) => {
                    link.fireEvent({ component: this }, event);
                });
            }
        };

        // notify source node
        this.getSourcePort().getNode().fireEvent({ component: this }, event);
        //  notify target node
        const targetNode = this.getTargetPort().getNode();
        // notify immediate target node
        targetNode.fireEvent({ component: this }, event);
        // notify target connection nodes
        selectTargetPort(targetNode, PortModelAlignment.BOTTOM, CellBounds.SouthBound);
        // notify target inter org service nodes
        selectTargetPort(targetNode, PortModelAlignment.RIGHT, CellBounds.EastBound);
    };

    selectLinkedNodes = () => {
        this.fireEventTroughLink("SELECT");
    };

    resetLinkedNodes = () => {
        this.fireEventTroughLink("UNSELECT");
    };

    getCurvePath = (): string => {
        const lineCurve = new BezierCurve();

        if (this.getSourcePort() && this.getTargetPort()) {
            const markerSpace: number = this.getType() === "componentLink" ? 70 : 120;

            lineCurve.setSource(this.getSourcePort().getPosition());
            lineCurve.setTarget(this.getTargetPort().getPosition());

            // With a leeway space for the marker
            const sourcePoint: Point = this.getSourcePort().getPosition().clone();
            const targetPoint: Point = this.getTargetPort().getPosition().clone();

            if (this.getTargetPort().getOptions().alignment === PortModelAlignment.LEFT) {
                targetPoint.x = targetPoint.x - markerSpace;
            } else if (this.getTargetPort().getOptions().alignment === PortModelAlignment.RIGHT) {
                targetPoint.x = targetPoint.x + markerSpace;
            } else if (this.getTargetPort().getOptions().alignment === PortModelAlignment.BOTTOM) {
                targetPoint.y = targetPoint.y + markerSpace;
            } else {
                targetPoint.y = targetPoint.y - markerSpace;
            }

            if (this.getSourcePort().getOptions().alignment === PortModelAlignment.LEFT) {
                sourcePoint.x = sourcePoint.x - markerSpace;
            } else if (this.getSourcePort().getOptions().alignment === PortModelAlignment.RIGHT) {
                sourcePoint.x = sourcePoint.x + markerSpace;
            } else if (this.getSourcePort().getOptions().alignment === PortModelAlignment.BOTTOM) {
                sourcePoint.y = sourcePoint.y + markerSpace;
            } else {
                sourcePoint.y = sourcePoint.y - markerSpace;
            }

            lineCurve.setSourceControl(sourcePoint);
            lineCurve.setTargetControl(targetPoint);
            lineCurve.getSourceControl().translate(...this.calculateControlOffset(this.getSourcePort()));
            lineCurve.getTargetControl().translate(...this.calculateControlOffset(this.getTargetPort()));
        }

        return lineCurve.getSVGCurve();
    };

    getArrowHeadPoints = (scale = 1): string => {
        let points: string = "";
        const sizeMultiplier = Math.max(Math.min(scale / 9, 4), 1);
        const targetPort: Point = this.getTargetPort().getPosition();

        if (this.getTargetPort().getOptions().alignment === PortModelAlignment.RIGHT) {
            points = `${targetPort.x + 2 * sizeMultiplier} ${targetPort.y}, ${targetPort.x + 12 * sizeMultiplier} ${
                targetPort.y + 6 * sizeMultiplier
            },
                ${targetPort.x + 12 * sizeMultiplier} ${targetPort.y - 6 * sizeMultiplier}`;
        } else if (this.getTargetPort().getOptions().alignment === PortModelAlignment.LEFT) {
            points = `${targetPort.x} ${targetPort.y}, ${targetPort.x - 14 * sizeMultiplier} ${
                targetPort.y + 10 * sizeMultiplier
            },
                ${targetPort.x - 14 * sizeMultiplier} ${targetPort.y - 10 * sizeMultiplier}`;
        } else if (this.getTargetPort().getOptions().alignment === PortModelAlignment.BOTTOM) {
            points = `${targetPort.x} ${targetPort.y + 2 * sizeMultiplier}, ${targetPort.x + 10 * sizeMultiplier} ${
                targetPort.y + 14 * sizeMultiplier
            },
                ${targetPort.x - 10 * sizeMultiplier} ${targetPort.y + 14 * sizeMultiplier}`;
        } else if (this.getTargetPort().getOptions().alignment === PortModelAlignment.TOP) {
            points = `${targetPort.x} ${targetPort.y}, ${targetPort.x + 10 * sizeMultiplier} ${
                targetPort.y - 15 * sizeMultiplier
            },
                ${targetPort.x - 10 * sizeMultiplier} ${targetPort.y - 15 * sizeMultiplier}`;
        }
        return points;
    };

    setObservations = (observations: Observations[], observationOnly?: boolean) => {
        this.observations = observations;
        if (observationOnly) {
            this.observationOnly = observationOnly;
        }
    };

    setTooltip = (tooltip: string) => {
        this.tooltip = tooltip;
    };

    getMidPoint = () => {
        const sourcePortPosition = this.getSourcePort().getPosition();
        const targetPortPosition = this.getTargetPort().getPosition();
        // Get midpoint of the link line
        return {
            x: (sourcePortPosition.x + targetPortPosition.x) / 2,
            y: (sourcePortPosition.y + targetPortPosition.y) / 2,
        };
    };

    scaleValueToLinkWidth = (
        requestCount: number,
        minRequestCount: number,
        maxRequestCount: number,
        maxPossibleRequestCount: number = 1000,
        minStrokeWidth: number = 2,
        maxFullStrokeWidth: number = 30
    ): number => {
        // Ensure the request count is within the min and max bounds
        const boundedRequestCount = Math.max(minRequestCount, Math.min(requestCount, maxRequestCount));
        const range = maxRequestCount - minRequestCount;
        const normalizedCount = (boundedRequestCount - minRequestCount) / range;
        const normalizedMaxCount = 1; // Normalized value of max count in the range
        const base = 10;
        // Logarithmic transformation with a base
        const logCount = Math.log(normalizedCount + 1) / Math.log(base);
        const logMaxCount = Math.log(normalizedMaxCount + 1) / Math.log(base);
        // Adjusting the scaling factor based on max request count
        const scalingFactor = maxRequestCount < maxPossibleRequestCount ? maxRequestCount / maxPossibleRequestCount : 1;
        // Scale to stroke width range
        const dynamicMaxStrokeWidth = minStrokeWidth + scalingFactor * (maxFullStrokeWidth - minStrokeWidth);
        const scale = (logCount / logMaxCount) * (dynamicMaxStrokeWidth - minStrokeWidth);
        return minStrokeWidth + scale;
    };

    getLinkArrowId = () => {
        // remove special characters from id
        const id = this.getID().replace(/[^a-zA-Z0-9]/g, "");
        return `${id  }-arrow`;
    };
}

export namespace SharedLink {
    export const Keyframes = keyframes`
		from {
			stroke-dashoffset: 24;
		}
		to {
			stroke-dashoffset: 0;
		}
	`;

    const selected = css`
        stroke-dasharray: 10, 6;
        animation: ${Keyframes} 1s linear infinite;
    `;

    export const Path = styled.path<{ selected: boolean }>`
        ${(p) => p.selected && selected};
        fill: none;
        pointer-events: auto;
    `;
}
