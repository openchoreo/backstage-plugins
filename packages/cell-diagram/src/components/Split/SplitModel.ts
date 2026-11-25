import { PortModelAlignment } from '@projectstorm/react-diagrams';
import { SharedNodeModel } from '../SharedNode/SharedNode';
import { ComponentPortModel } from '../Component/ComponentPort/ComponentPortModel';
import { Route } from '../../types';
import { NAME_JOIN_CHAR, SPLIT_DOT_WIDTH, SPLIT_NODE } from '../../resources';

export function getSplitNodeName(routeId: string): string {
  return `${SPLIT_NODE}${NAME_JOIN_CHAR}${routeId}`;
}

/** Where a route's requests fork to its backends. */
export class SplitModel extends SharedNodeModel {
  readonly route: Route;

  constructor(route: Route) {
    const name = getSplitNodeName(route.id);
    super(SPLIT_NODE, name);
    this.route = route;
    this.width = SPLIT_DOT_WIDTH;
    this.height = SPLIT_DOT_WIDTH;
    this.setLocked(true);

    this.addPort(new ComponentPortModel(name, PortModelAlignment.LEFT));
    this.addPort(new ComponentPortModel(name, PortModelAlignment.RIGHT));
    this.addPort(new ComponentPortModel(name, PortModelAlignment.TOP));
    this.addPort(new ComponentPortModel(name, PortModelAlignment.BOTTOM));
  }
}
