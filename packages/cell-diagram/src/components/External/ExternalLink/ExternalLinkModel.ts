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

import { PortModelAlignment } from "@projectstorm/react-diagrams";
import { BezierCurve, Point } from "@projectstorm/geometry";
import { SharedLinkModel } from "../../SharedLink/SharedLink";

interface LinkOrigins {
    nodeId: string;
}

export class ExternalLinkModel extends SharedLinkModel {
    sourceNode!: LinkOrigins;
    targetNode!: LinkOrigins;
    withRightOffset: boolean;

    constructor(id: string, withRightOffset: boolean = false) {
        super(id, "externalLink");
        this.withRightOffset = withRightOffset;
    }

    setSourceNode(nodeId: string) {
        this.sourceNode = { nodeId };
    }

    setTargetNode(nodeId: string) {
        this.targetNode = { nodeId };
    }

    getArrowHeadPoints = (): string => {
        let points: string = "";
        const targetPort: Point = this.getTargetPort().getPosition();

        if (this.getTargetPort().getOptions().alignment === PortModelAlignment.RIGHT) {
            points = `${targetPort.x + 6} ${targetPort.y}, ${targetPort.x + 16} ${targetPort.y + 10},
                ${targetPort.x + 16} ${targetPort.y - 10}`;
        } else if (this.getTargetPort().getOptions().alignment === PortModelAlignment.LEFT) {
            points = `${targetPort.x} ${targetPort.y}, ${targetPort.x - 14} ${targetPort.y + 10},
                ${targetPort.x - 14} ${targetPort.y - 10}`;
        } else if (this.getTargetPort().getOptions().alignment === PortModelAlignment.BOTTOM) {
            points = `${targetPort.x} ${targetPort.y + 2}, ${targetPort.x + 10} ${targetPort.y + 14},
				${targetPort.x - 10} ${targetPort.y + 14}`;
        } else if (this.getTargetPort().getOptions().alignment === PortModelAlignment.TOP) {
            points = `${targetPort.x} ${targetPort.y}, ${targetPort.x + 10} ${targetPort.y - 15},
					${targetPort.x - 10} ${targetPort.y - 15}`;
        }
        return points;
    };

    getCurvePath = (): string => {
        const lineCurve = new BezierCurve();

        if (this.getSourcePort() && this.getTargetPort()) {
            const markerSpace: number = 60;

            // With a leeway space for the marker
            const sourcePoint: Point = this.getSourcePort().getPosition().clone();
            const targetPoint: Point = this.getTargetPort().getPosition().clone();

            if (this.getTargetPort().getOptions().alignment === PortModelAlignment.LEFT) {
                targetPoint.x -= markerSpace;
            } else if (this.getTargetPort().getOptions().alignment === PortModelAlignment.RIGHT) {
                targetPoint.x += markerSpace;
            } else if (this.getTargetPort().getOptions().alignment === PortModelAlignment.BOTTOM) {
                targetPoint.y += markerSpace;
            } else {
                targetPoint.y -= markerSpace;
            }

            lineCurve.setSource(this.getSourcePort().getPosition());
            lineCurve.setTarget(this.getTargetPort().getPosition());
            lineCurve.setSourceControl(sourcePoint);
            lineCurve.setTargetControl(targetPoint);
            lineCurve.getSourceControl().translate(...this.calculateControlOffset(this.getSourcePort()));
            lineCurve.getTargetControl().translate(...this.calculateControlOffset(this.getTargetPort()));
        }

        return lineCurve.getSVGCurve();
    };

    getCurvePathWithOffset = (): string => {
        const lineCurve = new BezierCurve();

        if (this.getSourcePort() && this.getTargetPort()) {
            const markerSpace: number = 60;

            const sourcePoint: Point = this.getSourcePort().getPosition().clone();
            const targetPoint: Point = this.getTargetPort().getPosition().clone();
            const middlePoint = new Point(targetPoint.x + 100, sourcePoint.y - 100);

            if (this.getTargetPort().getOptions().alignment === PortModelAlignment.LEFT) {
                targetPoint.x -= markerSpace;
            } else if (this.getTargetPort().getOptions().alignment === PortModelAlignment.RIGHT) {
                targetPoint.x += markerSpace;
            } else if (this.getTargetPort().getOptions().alignment === PortModelAlignment.BOTTOM) {
                targetPoint.y += markerSpace;
            } else {
                targetPoint.y -= markerSpace;
            }

            lineCurve.setSource(this.getSourcePort().getPosition());
            lineCurve.setTarget(this.getTargetPort().getPosition());
            lineCurve.setSourceControl(middlePoint);
            lineCurve.setTargetControl(targetPoint);
            lineCurve.getSourceControl().translate(...this.calculateControlOffset(this.getSourcePort()));
            lineCurve.getTargetControl().translate(...this.calculateControlOffset(this.getTargetPort()));
        }

        return lineCurve.getSVGCurve();
    };

    getTwoBendPath = (): string => {
        let path = "";
        let startHorizontally = false;

        if (
            this.getTargetPort().getOptions().alignment === PortModelAlignment.LEFT ||
            this.getTargetPort().getOptions().alignment === PortModelAlignment.RIGHT
        ) {
            startHorizontally = true;
        }

        if (this.getSourcePort() && this.getTargetPort()) {
            const sourcePoint: Point = this.getSourcePort().getPosition().clone();
            const targetPoint: Point = this.getTargetPort().getPosition().clone();

            if (startHorizontally) {
                // Start horizontally, then bend in the center of the y-axis
                path = `M ${sourcePoint.x} ${sourcePoint.y} `;
                path += `L ${(sourcePoint.x + targetPoint.x) / 2} ${sourcePoint.y} `;
                path += `L ${(sourcePoint.x + targetPoint.x) / 2} ${targetPoint.y} `;
                path += `L ${targetPoint.x} ${targetPoint.y}`;
            } else {
                // Start vertically, then bend in the center of the x-axis
                path = `M ${sourcePoint.x} ${sourcePoint.y} `;
                path += `L ${sourcePoint.x} ${(sourcePoint.y + targetPoint.y) / 2} `;
                path += `L ${targetPoint.x} ${(sourcePoint.y + targetPoint.y) / 2} `;
                path += `L ${targetPoint.x} ${targetPoint.y}`;
            }
        }

        return path;
    };
}
