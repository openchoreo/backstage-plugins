import { DiagramEngine, PortModel } from '@projectstorm/react-diagrams';
import { AbstractModelFactory } from '@projectstorm/react-canvas-core';
import { ConnectionPortModel } from './ConnectionPortModel';

export class ConnectionPortFactory extends AbstractModelFactory<PortModel, DiagramEngine> {
    constructor() {
        super('connectionPort');
    }

    generateModel(event: { initialConfig: any }): ConnectionPortModel {
        return new ConnectionPortModel(event.initialConfig.id, event.initialConfig.portType);
    }
}
