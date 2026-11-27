import { AbstractReactFactory } from '@projectstorm/react-canvas-core';
import { DiagramEngine } from '@projectstorm/react-diagrams-core';
import { SplitModel } from './SplitModel';
import { SplitWidget } from './SplitWidget';
import { SPLIT_NODE } from '../../resources';

export class SplitFactory extends AbstractReactFactory<
  SplitModel,
  DiagramEngine
> {
  constructor() {
    super(SPLIT_NODE);
  }

  generateReactWidget(event: { model: SplitModel }): JSX.Element {
    return <SplitWidget engine={this.engine} node={event.model} />;
  }

  generateModel(event: { initialConfig: any }) {
    return new SplitModel(event.initialConfig.route);
  }
}
