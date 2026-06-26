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

import { DiagramEngine, PortModelAlignment } from "@projectstorm/react-diagrams";
import { EmptyModel } from "./EmptyModel";
import { EmptyNode } from "./styles";
import { CellPortWidget } from "../CellPort/CellPortWidget";
import { CellPortModel } from "../CellPort/CellPortModel";
import { getNodePortId } from "../cell-util";
import { useDiagramContext } from "../../DiagramContext/DiagramContext";

interface EmptyWidgetProps {
    node: EmptyModel;
    engine: DiagramEngine;
}

export function EmptyWidget(props: EmptyWidgetProps) {
    const { node, engine } = props;
    const { previewMode } = useDiagramContext();

    return (
        <EmptyNode width={node.width} previewMode={previewMode}>
            <CellPortWidget port={node.getPort(getNodePortId(node.getID(), PortModelAlignment.TOP)) as CellPortModel} engine={engine} />
            <CellPortWidget port={node.getPort(getNodePortId(node.getID(), PortModelAlignment.BOTTOM)) as CellPortModel} engine={engine} />
            <CellPortWidget port={node.getPort(getNodePortId(node.getID(), PortModelAlignment.LEFT)) as CellPortModel} engine={engine} />
            <CellPortWidget port={node.getPort(getNodePortId(node.getID(), PortModelAlignment.RIGHT)) as CellPortModel} engine={engine} />
        </EmptyNode>
    );
}
