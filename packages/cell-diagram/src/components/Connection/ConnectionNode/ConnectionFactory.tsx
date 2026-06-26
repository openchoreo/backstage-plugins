import { AbstractReactFactory } from '@projectstorm/react-canvas-core';
import { DiagramEngine } from '@projectstorm/react-diagrams-core';
import { ConnectionModel } from './ConnectionModel';
import { ConnectionWidget } from './ConnectionWidget';
import { CONNECTION_NODE } from '../../../resources';

export class ConnectionFactory extends AbstractReactFactory<ConnectionModel, DiagramEngine> {
    constructor() {
        super(CONNECTION_NODE);
    }

    generateReactWidget(event: { model: ConnectionModel }): JSX.Element {
        return <ConnectionWidget engine={this.engine} node={event.model} />;
    }

    generateModel(event: { initialConfig: any }) {
        return new ConnectionModel(event.initialConfig.connection);
    }
}
