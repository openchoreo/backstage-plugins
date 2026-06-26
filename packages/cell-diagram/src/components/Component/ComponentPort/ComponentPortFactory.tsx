import { DiagramEngine, PortModel } from '@projectstorm/react-diagrams';
import { AbstractModelFactory } from '@projectstorm/react-canvas-core';
import { ComponentPortModel } from './ComponentPortModel';

export class ComponentPortFactory extends AbstractModelFactory<PortModel, DiagramEngine> {
    constructor() {
        super('componentPort');
    }

    generateModel(event: { initialConfig: any }): ComponentPortModel {
        return new ComponentPortModel(event.initialConfig.id, event.initialConfig.portType);
    }
}
