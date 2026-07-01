import { PortModelAlignment } from '@projectstorm/react-diagrams';
import { SharedNodeModel } from '../../SharedNode/SharedNode';
import { CellPortModel } from '../../Cell/CellPort/CellPortModel';
import { EXTERNAL_NODE } from '../../../resources';
import { getExternalNodeName } from '../external-node-util';

export class ExternalModel extends SharedNodeModel {
  constructor(id: string) {
    const name = getExternalNodeName(id);
    super(EXTERNAL_NODE, name);

    this.addPort(new CellPortModel(name, PortModelAlignment.LEFT));
    this.addPort(new CellPortModel(name, PortModelAlignment.RIGHT));
    this.addPort(new CellPortModel(name, PortModelAlignment.TOP));
    this.addPort(new CellPortModel(name, PortModelAlignment.BOTTOM));
  }
}
