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

import { CSSProperties } from "react";
import { DiagramEngine, PortModelAlignment, PortWidget } from "@projectstorm/react-diagrams";
import { ComponentPortModel } from "./ComponentPortModel";
import { inclusionPortStyles, sidePortStyles } from "./styles";

interface CustomPortProps {
    port: ComponentPortModel;
    engine: DiagramEngine;
}

function getPortStyles(alignment: PortModelAlignment | undefined): CSSProperties {
    if (alignment === PortModelAlignment.LEFT) {
        return { left: 0, ...sidePortStyles };
    }
    if (alignment === PortModelAlignment.RIGHT) {
        return { right: 0, ...sidePortStyles };
    }
    if (alignment === PortModelAlignment.TOP) {
        return { top: 0, ...inclusionPortStyles };
    }
    return { bottom: 0, ...inclusionPortStyles };
}

export function ComponentPortWidget(props: CustomPortProps) {
    const { port, engine } = props;
    const portStyles: CSSProperties = getPortStyles(port.getOptions().alignment);

    return <PortWidget engine={engine} port={port} style={portStyles} />;
}
