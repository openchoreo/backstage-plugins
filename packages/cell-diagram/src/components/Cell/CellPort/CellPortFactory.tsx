import { DiagramEngine, PortModel } from '@projectstorm/react-diagrams';
import { AbstractModelFactory } from '@projectstorm/react-canvas-core';
import { CellPortModel } from './CellPortModel';

export class CellPortFactory extends AbstractModelFactory<PortModel, DiagramEngine> {
    constructor() {
        super('cellPort');
    }

    generateModel(event: { initialConfig: any }): CellPortModel {
        return new CellPortModel(event.initialConfig.id, event.initialConfig.portType);
    }
}
