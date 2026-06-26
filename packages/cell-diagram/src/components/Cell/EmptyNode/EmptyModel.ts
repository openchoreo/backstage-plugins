import { PortModelAlignment } from '@projectstorm/react-diagrams';
import { SharedNodeModel } from '../../SharedNode/SharedNode';
import { CellPortModel } from '../CellPort/CellPortModel';
import { getEmptyNodeName } from "../cell-util";
import { CellBounds } from '../CellNode/CellModel';
import { CIRCLE_WIDTH, EMPTY_NODE } from '../../../resources';

export class EmptyModel extends SharedNodeModel {
    readonly bound: CellBounds;
    readonly width: number;

    constructor(bound: CellBounds, width?:number, suffix?: string) {
        const name = getEmptyNodeName(bound, suffix ?? "");
        super(EMPTY_NODE, name);
        this.bound = bound;
        this.width = width || CIRCLE_WIDTH;
        this.setLocked(true);

        this.addPort(new CellPortModel(name , PortModelAlignment.TOP));
        this.addPort(new CellPortModel(name, PortModelAlignment.BOTTOM));
        this.addPort(new CellPortModel(name, PortModelAlignment.LEFT));
        this.addPort(new CellPortModel(name, PortModelAlignment.RIGHT));       
    }
}
