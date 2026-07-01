import { PortModel, PortModelAlignment } from '@projectstorm/react-diagrams';

export class ComponentPortModel extends PortModel {
  constructor(id: string, portType: PortModelAlignment) {
    super({
      type: 'componentPort',
      name: `${portType}-${id}`,
      id: `${portType}-${id}`,
      alignment: portType,
    });
  }

  isLocked(): boolean {
    return true;
  }
}
