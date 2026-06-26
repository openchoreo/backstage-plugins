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

import { DiagramEngine, PortModelAlignment, PortWidget } from "@projectstorm/react-diagrams";
import { ProjectPortModel } from "./ProjectPortModel";
import { BottomPortNode, LeftPortNode, PortNode, RightPortNode, TopPortNode } from "./styles";

interface CustomPortProps {
    port: ProjectPortModel;
    engine: DiagramEngine;
    isSelected: boolean;
}

export function ProjectPortWidget(props: CustomPortProps) {
    const { port, engine, isSelected } = props;

    let DynamicPotNode = PortNode;

    switch (port.getOptions().alignment) {
        case PortModelAlignment.LEFT:
            DynamicPotNode = LeftPortNode;
            break;
        case PortModelAlignment.RIGHT:
            DynamicPotNode = RightPortNode;
            break;
        case PortModelAlignment.TOP:
            DynamicPotNode = TopPortNode;
            break;
        case PortModelAlignment.BOTTOM:
            DynamicPotNode = BottomPortNode;
            break;
        default:
            break;
    }

    return (
        <DynamicPotNode isSelected={isSelected}>
            <PortWidget engine={engine} port={port} />
        </DynamicPotNode>
    );
}
