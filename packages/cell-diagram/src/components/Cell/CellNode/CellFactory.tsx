import { AbstractReactFactory } from '@projectstorm/react-canvas-core';
import { DiagramEngine } from '@projectstorm/react-diagrams-core';
import { CellModel } from './CellModel';
import { CellWidget } from './CellWidget';

export class CellFactory extends AbstractReactFactory<
  CellModel,
  DiagramEngine
> {
  constructor() {
    super('cellNode');
  }

  generateReactWidget(event: { model: CellModel }): JSX.Element {
    return <CellWidget engine={this.engine} node={event.model} />;
  }

  generateModel(event: { initialConfig: any }) {
    return new CellModel(event.initialConfig.key, event.initialConfig.cell);
  }
}
