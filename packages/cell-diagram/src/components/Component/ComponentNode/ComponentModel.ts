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
import { SharedNodeModel } from "../../SharedNode/SharedNode";
import { ComponentPortModel } from "../ComponentPort/ComponentPortModel";
import { Component, ComponentType } from "../../../types";
import { COMPONENT_NODE } from "../../../resources";
import { getComponentName } from "../component-node-util";

export class ComponentModel extends SharedNodeModel {
    readonly component: Component;

    constructor(component: Component) {
        const name = getComponentName(component);
        super(COMPONENT_NODE, name);
        this.component = component;

        this.addPort(new ComponentPortModel(name, PortModelAlignment.LEFT));
        this.addPort(new ComponentPortModel(name, PortModelAlignment.RIGHT));

        this.addPort(new ComponentPortModel(name, PortModelAlignment.TOP));
        this.addPort(new ComponentPortModel(name, PortModelAlignment.BOTTOM));
    }

    isExternalConsumer(): boolean {
        return this.component.type === ComponentType.EXTERNAL_CONSUMER;
    }
}
