import { PortModel, PortModelAlignment } from '@projectstorm/react-diagrams';

export class ConnectionPortModel extends PortModel {
  constructor(id: string, portType: PortModelAlignment) {
    super({
      type: 'connectionPort',
      name: `${portType}-${id}`,
      id: `${portType}-${id}`,
      alignment: portType,
    });
  }

  isLocked(): boolean {
    return true;
  }
}
