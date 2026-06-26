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

import { useContext, useEffect, useState } from "react";
import { DiagramEngine, PortModelAlignment } from "@projectstorm/react-diagrams";
import { CellBounds, CellModel } from "./CellModel";
import {
    CellNode,
    TopPortCircle,
    LeftPortCircle,
    BottomPortsWrapper,
    DotWrapper,
    Dot,
    IconWrapper,
    TopIconWrapper,
    RightPortsWrapper,
} from "./styles";
import { CellPortWidget } from "../CellPort/CellPortWidget";
import { CellPortModel } from "../CellPort/CellPortModel";
import { getCellPortId, getRoundedOctagonSVG } from "../cell-util";
import { CELL_LINE_MIN_WIDTH, CELL_LINE_PREVIEW_WIDTH, ICON_SCALE, MAIN_CELL } from "../../../resources";
import { GatewayIcon } from "../../../resources/assets/icons/GatewayIcon";
import { DiagramContext } from "../../DiagramContext/DiagramContext";

export const generateRoundedOctagonSVG = (diagramHeight: number, radiusMultiplier: number) => {
    const sideLength = (diagramHeight * 4.14) / 10;
    const { width, height, path } = getRoundedOctagonSVG(sideLength, sideLength * radiusMultiplier);
    return (
        <svg width={width} height={height} id={MAIN_CELL}>
            <g transform={`rotate(${45 / 2}, ${width/2}, ${height/2})`}>
                <path d={path} />
            </g>
        </svg>
    );
};

interface CellWidgetProps {
    node: CellModel;
    engine: DiagramEngine;
}

export function CellWidget(props: CellWidgetProps) {
    const { node, engine } = props;

    const { zoomLevel, previewMode } = useContext(DiagramContext);
    const [cellHeight, setCellHeight] = useState<number>(node.width);

    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        resizeCellHeight();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [node]);

    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        resizeCellHeight();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [node.width]);

    const resizeCellHeight = () => {
        const conCount = node.connectorNodes?.length || 0;
        const connectorRowWidth = ((conCount * 100 + 40) * 100) / 40;
        setCellHeight(Math.max(connectorRowWidth, node.width));
        engine.repaintCanvas();
    };

    const strokeWidth = previewMode 
        ? Math.max((cellHeight / 200), CELL_LINE_PREVIEW_WIDTH) 
        : node.getDynamicLineWidth(zoomLevel, CELL_LINE_MIN_WIDTH);

    const transform = previewMode ? `scale(${ICON_SCALE.PREVIEW})` : "none";

    return (
        <CellNode height={cellHeight} borderWidth={strokeWidth}>
            {generateRoundedOctagonSVG(cellHeight, 0.08)}

            <TopPortCircle show={Boolean(node.gateways?.internet)}>
                <TopIconWrapper>
                    <GatewayIcon styles={{ transform }} />
                </TopIconWrapper>
                <CellPortWidget
                    port={node.getPort(getCellPortId(node.getID(), CellBounds.NorthBound, PortModelAlignment.TOP)) as CellPortModel}
                    engine={engine}
                />
                <CellPortWidget
                    port={node.getPort(getCellPortId(node.getID(), CellBounds.NorthBound, PortModelAlignment.BOTTOM)) as CellPortModel}
                    engine={engine}
                />
            </TopPortCircle>

            <LeftPortCircle show={Boolean(node.gateways?.intranet)}>
                <IconWrapper>
                    <GatewayIcon styles={{ transform }}/>
                </IconWrapper>
                <CellPortWidget
                    port={node.getPort(getCellPortId(node.getID(), CellBounds.WestBound, PortModelAlignment.LEFT)) as CellPortModel}
                    engine={engine}
                />
                <CellPortWidget
                    port={node.getPort(getCellPortId(node.getID(), CellBounds.WestBound, PortModelAlignment.RIGHT)) as CellPortModel}
                    engine={engine}
                />
            </LeftPortCircle>

            <RightPortsWrapper>
                {node.connectionNodes?.map((connectionNode) => {
                    return (
                        <DotWrapper key={connectionNode.getID()}>
                            <Dot>
                                <CellPortWidget
                                    port={node.getPort(
                                        getCellPortId(
                                            node.getID(),
                                            CellBounds.EastBound,
                                            PortModelAlignment.LEFT,
                                            connectionNode.connection.id
                                        )
                                    ) as CellPortModel}
                                    engine={engine}
                                />
                                <CellPortWidget
                                    port={node.getPort(
                                        getCellPortId(
                                            node.getID(),
                                            CellBounds.EastBound,
                                            PortModelAlignment.RIGHT,
                                            connectionNode.connection.id
                                        )
                                    ) as CellPortModel}
                                    engine={engine}
                                />
                            </Dot>
                        </DotWrapper>
                    );
                })}
            </RightPortsWrapper>
            <BottomPortsWrapper>
                {node.connectorNodes?.map((connectorNode) => {
                    return (
                        <DotWrapper key={connectorNode.getID()}>
                            <Dot>
                                <CellPortWidget
                                    port={node.getPort(
                                        getCellPortId(
                                            node.getID(),
                                            CellBounds.SouthBound,
                                            PortModelAlignment.TOP,
                                            connectorNode.connection.id
                                        )
                                    ) as CellPortModel}
                                    engine={engine}
                                />
                                <CellPortWidget
                                    port={node.getPort(
                                        getCellPortId(
                                            node.getID(),
                                            CellBounds.SouthBound,
                                            PortModelAlignment.BOTTOM,
                                            connectorNode.connection.id
                                        )
                                    ) as CellPortModel}
                                    engine={engine}
                                />
                            </Dot>
                        </DotWrapper>
                    );
                })}
            </BottomPortsWrapper>
        </CellNode>
    );
}
