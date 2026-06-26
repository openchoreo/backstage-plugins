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
