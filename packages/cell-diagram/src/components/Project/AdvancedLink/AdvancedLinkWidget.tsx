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

import { Component, createRef, MouseEvent, RefObject } from "react";
import { DiagramEngine, PointModel } from "@projectstorm/react-diagrams-core";
import { ListenerHandle } from "@projectstorm/react-canvas-core";
import { AdvancedLinkModel } from "./AdvancedLinkModel";
import { AdvancedLinkPointWidget } from "./AdvancedLinkPointWidget";
import { AdvancedLinkSegmentWidget } from "./AdvancedLinkSegmentWidget";

export interface AdvancedLinkProps {
    link: AdvancedLinkModel;
    diagramEngine: DiagramEngine;
    pointAdded?: (point: PointModel, event: MouseEvent) => any;
    renderPoints?: boolean;
    selected?: (event: MouseEvent) => any;
}

export interface AdvancedLinkState {
    selected: boolean;
    listener?: ListenerHandle;
}

export class AdvancedLinkWidget extends Component<AdvancedLinkProps, AdvancedLinkState> {
    refPaths: RefObject<SVGPathElement>[];

    constructor(props: AdvancedLinkProps) {
        super(props);
        this.refPaths = [];
        this.state = {
            selected: false,
        };
    }

    // eslint-disable-next-line react/sort-comp
    renderPoints() {
        return this.props.renderPoints ?? true;
    }

    // eslint-disable-next-line react/sort-comp
    componentDidUpdate(): void {
        this.props.link.setRenderedPaths(
            this.refPaths.map((ref) => {
                return ref.current;
            }) as SVGPathElement[]
        );
    }

    componentDidMount(): void {
        this.props.link.setRenderedPaths(
            this.refPaths.map((ref) => {
                return ref.current;
            }) as SVGPathElement[]
        );
        const listener = this.props.link.registerListener({
            SELECT: this.selectPath,
            UNSELECT: this.unselectPath,
        });
        this.setState({ listener });
    }

    componentWillUnmount(): void {
        this.props.link.setRenderedPaths([]);
        if (this.state.listener) {
            this.props.link.deregisterListener(this.state.listener);
        }
    }

    selectPath = () => {
        this.setState({ selected: true });
    };

    unselectPath = () => {
        this.setState({ selected: false });
    };

    addPointToLink(event: MouseEvent, index: number) {
        if (
            !event.shiftKey &&
            !this.props.link.isLocked() &&
            this.props.link.getPoints().length - 1 <= this.props.diagramEngine.getMaxNumberPointsPerLink()
        ) {
            const position = this.props.diagramEngine.getRelativeMousePoint(event);
            const point = this.props.link.point(position.x, position.y, index);
            event.persist();
            event.stopPropagation();
            this.forceUpdate(() => {
                this.props.diagramEngine.getActionEventBus().fireAction({
                    event,
                    model: point,
                });
            });
        }
    }

    generatePoint(point: PointModel): JSX.Element {
        return (
            <AdvancedLinkPointWidget
                key={point.getID()}
                point={point as any}
                colorSelected={this.props.link.getOptions().selectedColor}
                color={this.props.link.getOptions().color}
            />
        );
    }

    generateLink(path: string, extraProps: any, id: string | number, showArrow?: boolean): JSX.Element {
        const ref = createRef<SVGPathElement>();
        this.refPaths.push(ref);
        return (
            <AdvancedLinkSegmentWidget
                key={`link-${id}`}
                path={path}
                selected={this.state.selected}
                diagramEngine={this.props.diagramEngine}
                factory={this.props.diagramEngine.getFactoryForLink(this.props.link)}
                link={this.props.link}
                forwardRef={ref}
                onSelection={(selected) => {
                    this.setState({ selected: selected });
                }}
                extras={extraProps}
                showArrow={showArrow}
            />
        );
    }

    render() {
        // ensure id is present for all points on the path
        const points = this.props.link.getPoints();
        const paths = [];
        this.refPaths = [];

        // draw curve line if the link is not a reverse link
        if (points.length === 2 || this.props.link.getFirstPoint().getX() < this.props.link.getLastPoint().getX()) {
            paths.push(
                this.generateLink(
                    this.props.link.getSVGPath(),
                    {
                        onMouseDown: (event: MouseEvent<Element, globalThis.MouseEvent>) => {
                            this.props.selected?.(event);
                        },
                    },
                    "0",
                    true
                )
            );

            // draw the link as dangeling
            if (this.props.link.getTargetPort() === null) {
                paths.push(this.generatePoint(points[1]));
            }
        } else {
            // draw the multiple anchors and complex line instead
            for (let j = 0; j < points.length - 1; j++) {
                paths.push(
                    this.generateLink(
                        this.props.link.getSVGPathSegment(points[j], points[j + 1]),
                        {
                            "data-linkid": this.props.link.getID(),
                            "data-point": j,
                            onMouseDown: (event: MouseEvent) => {
                                this.props.selected?.(event);
                                this.addPointToLink(event, j + 1);
                            },
                        },
                        j,
                        j === points.length - 2
                    )
                );
            }

            if (this.renderPoints()) {
                // render the circles
                for (let i = 1; i < points.length - 1; i++) {
                    paths.push(this.generatePoint(points[i]));
                }

                if (this.props.link.getTargetPort() === null) {
                    paths.push(this.generatePoint(points[points.length - 1]));
                }
            }
        }

        return (
            <g data-default-link-test={this.props.link.getOptions().testName}>
                {paths}
            </g>
        );
    }
}
