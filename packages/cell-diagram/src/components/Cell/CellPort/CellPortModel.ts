import { PortModel, PortModelAlignment } from '@projectstorm/react-diagrams';

export class CellPortModel extends PortModel {
    constructor(id: string, portType: PortModelAlignment) {
        super({
            type: 'cellPort',
            name: `${portType}-${id}`,
            id: `${portType}-${id}`,
            alignment: portType
        });
    }

    isLocked(): boolean {
        return true;
    }
}
