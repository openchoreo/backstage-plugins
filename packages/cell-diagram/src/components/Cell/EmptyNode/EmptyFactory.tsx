import { AbstractReactFactory } from '@projectstorm/react-canvas-core';
import { DiagramEngine } from '@projectstorm/react-diagrams-core';
import { EmptyModel } from './EmptyModel';
import { EmptyWidget } from './EmptyWidget';
import { EMPTY_NODE } from '../../../resources';

export class EmptyFactory extends AbstractReactFactory<
  EmptyModel,
  DiagramEngine
> {
  constructor() {
    super(EMPTY_NODE);
  }

  generateReactWidget(event: { model: EmptyModel }): JSX.Element {
    return <EmptyWidget engine={this.engine} node={event.model} />;
  }

  generateModel(event: { initialConfig: any }) {
    return new EmptyModel(event.initialConfig.key, event.initialConfig.cell);
  }
}
