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
import { CellPortModel } from "../../Cell/CellPort/CellPortModel";
import { EXTERNAL_NODE } from "../../../resources";
import { getExternalNodeName } from "../external-node-util";

export class ExternalModel extends SharedNodeModel {
    constructor(id: string) {
        const name = getExternalNodeName(id);
        super(EXTERNAL_NODE, name);

        this.addPort(new CellPortModel(name, PortModelAlignment.LEFT));
        this.addPort(new CellPortModel(name, PortModelAlignment.RIGHT));
        this.addPort(new CellPortModel(name, PortModelAlignment.TOP));
        this.addPort(new CellPortModel(name, PortModelAlignment.BOTTOM));
    }
}
