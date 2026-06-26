import { DefaultPortModel, PortModelAlignment } from '@projectstorm/react-diagrams';

export class ProjectPortModel extends DefaultPortModel {
    constructor(id: string, portType: PortModelAlignment) {
        super({
            type: 'projectPort',
            name: `${portType}-${id}`,
            id: `${portType}-${id}`,
            alignment: portType
        });
    }

    isLocked(): boolean {
        return true;
    }
}
