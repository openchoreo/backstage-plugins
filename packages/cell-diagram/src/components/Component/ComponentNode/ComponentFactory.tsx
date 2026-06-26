import { AbstractReactFactory } from '@projectstorm/react-canvas-core';
import { DiagramEngine } from '@projectstorm/react-diagrams-core';
import { ComponentModel } from './ComponentModel';
import { ComponentWidget } from './ComponentWidget';
import { COMPONENT_NODE } from '../../../resources';

export class ComponentFactory extends AbstractReactFactory<ComponentModel, DiagramEngine> {
    constructor() {
        super(COMPONENT_NODE);
    }

    generateReactWidget(event: { model: ComponentModel }): JSX.Element {
        return <ComponentWidget engine={this.engine} node={event.model} />;
    }

    generateModel(event: { initialConfig: any }) {
        return new ComponentModel(event.initialConfig.component);
    }
}
