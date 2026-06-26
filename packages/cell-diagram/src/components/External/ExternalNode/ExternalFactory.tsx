import { AbstractReactFactory } from '@projectstorm/react-canvas-core';
import { DiagramEngine } from '@projectstorm/react-diagrams-core';
import { ExternalModel } from './ExternalModel';
import { ExternalWidget } from './ExternalWidget';
import { EXTERNAL_NODE } from '../../../resources';

export class ExternalFactory extends AbstractReactFactory<ExternalModel, DiagramEngine> {
    constructor() {
        super(EXTERNAL_NODE);
    }

    generateReactWidget(event: { model: ExternalModel }): JSX.Element {
        return <ExternalWidget engine={this.engine} node={event.model} />;
    }

    generateModel(event: { initialConfig: any }) {
        return new ExternalModel(event.initialConfig.key);
    }
}
