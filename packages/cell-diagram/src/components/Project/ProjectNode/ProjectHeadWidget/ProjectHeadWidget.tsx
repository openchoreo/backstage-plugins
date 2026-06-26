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

import { DiagramEngine } from "@projectstorm/react-diagrams";
import { ProjectModel } from "../ProjectModel";
import { ProjectCellNode } from "../styles";
import { MoreVertMenuItem } from "../../../../types";
import { ProjectPortWidget } from "../../ProjectPort/ProjectPortWidget";
import { generateRoundedOctagonSVG } from "../../../Cell/CellNode/CellWidget";
import { CellBounds } from "../../../Cell/CellNode/CellModel";
import { CELL_LINE_MIN_WIDTH, COMPONENT_CIRCLE_WIDTH } from "../../../../resources";

interface ServiceHeadProps {
    engine: DiagramEngine;
    node: ProjectModel;
    isSelected: boolean;
    isFocused: boolean;
    menuItems?: MoreVertMenuItem[];
}

export function ProjectHeadWidget(props: ServiceHeadProps) {
    const { engine, node, isSelected, isFocused } = props;

    const cellHeight = COMPONENT_CIRCLE_WIDTH;
    const strokeWidth = CELL_LINE_MIN_WIDTH;
    const isExposedToInternet = node.project.connections?.some(
        (connection) => connection.source?.boundary === CellBounds.NorthBound
    );
    const hasExternalDependencies = node.project.connections?.some(
        (connection) => connection.source?.boundary === CellBounds.SouthBound
    );
    const hasInternalDependencies = node.project.connections?.some(
        (connection) => connection.source?.boundary === CellBounds.EastBound
    );

    return (
        <ProjectCellNode
            id={node.project.id}
            height={cellHeight}
            borderWidth={strokeWidth}
            isSelected={isSelected || isFocused}
        >
            {generateRoundedOctagonSVG(cellHeight, 0.3)}

            {isExposedToInternet && (
                <ProjectPortWidget
                    port={node.getPort(`top-${node.getID()}`)}
                    engine={engine}
                    isSelected={isSelected || isFocused}
                />
            )}
            {hasExternalDependencies && (
                <ProjectPortWidget
                    port={node.getPort(`bottom-${node.getID()}`)}
                    engine={engine}
                    isSelected={isSelected || isFocused}
                />
            )}
            <ProjectPortWidget
                port={node.getPort(`left-${node.getID()}`)}
                engine={engine}
                isSelected={isSelected || isFocused}
            />
            {hasInternalDependencies && (
                <ProjectPortWidget
                    port={node.getPort(`right-${node.getID()}`)}
                    engine={engine}
                    isSelected={isSelected || isFocused}
                />
            )}
        </ProjectCellNode>
    );
}
