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
import { ConnectionPortModel } from "../ConnectionPort/ConnectionPortModel";
import { Connection } from "../../../types";
import { CONNECTION_NODE } from "../../../resources";
import { getConnectionName } from "../connection-node-util";

export enum Orientation {
    VERTICAL = "vertical",
    HORIZONTAL = "horizontal",
}

export class ConnectionModel extends SharedNodeModel {
    readonly connection: Connection;
    readonly orientation: Orientation;

    constructor(connection: Connection, orientation?: Orientation) {
        const name = getConnectionName(connection);
        super(CONNECTION_NODE, name);
        this.connection = connection;
        this.orientation = orientation || Orientation.VERTICAL;

        this.addPort(new ConnectionPortModel(name, PortModelAlignment.TOP));
        this.addPort(new ConnectionPortModel(name, PortModelAlignment.BOTTOM));

        this.addPort(new ConnectionPortModel(name, PortModelAlignment.LEFT));
        this.addPort(new ConnectionPortModel(name, PortModelAlignment.RIGHT));
    }
}
