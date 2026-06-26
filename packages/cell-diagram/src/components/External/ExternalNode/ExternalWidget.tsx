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

import {  } from "react";
import { DiagramEngine } from "@projectstorm/react-diagrams";
import { ExternalModel } from "./ExternalModel";
import { ExternalNode } from "./styles";
import { CellPortWidget } from "../../Cell/CellPort/CellPortWidget";
import { CellPortModel } from "../../Cell/CellPort/CellPortModel";

interface ExternalWidgetProps {
    node: ExternalModel;
    engine: DiagramEngine;
}

export function ExternalWidget(props: ExternalWidgetProps) {
    const { node, engine } = props;
    return (
        <ExternalNode>
            <CellPortWidget port={node.getPort(`left-${node.getID()}`) as CellPortModel} engine={engine} />
            <CellPortWidget port={node.getPort(`right-${node.getID()}`) as CellPortModel} engine={engine} />
            <CellPortWidget port={node.getPort(`top-${node.getID()}`) as CellPortModel} engine={engine} />
            <CellPortWidget port={node.getPort(`bottom-${node.getID()}`) as CellPortModel} engine={engine} />
        </ExternalNode>
    );
}
