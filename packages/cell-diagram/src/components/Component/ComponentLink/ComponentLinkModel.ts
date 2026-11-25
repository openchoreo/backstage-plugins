import { COMPONENT_LINK } from '../../../resources';
import { SharedLinkModel } from '../../SharedLink/SharedLink';

interface LinkOrigins {
  nodeId: string;
}

export class ComponentLinkModel extends SharedLinkModel {
  sourceNode!: LinkOrigins;
  targetNode!: LinkOrigins;
  /** A route branch's share or condition, drawn on the line. */
  label?: string;
  faded?: boolean;
  copy?: boolean;
  hideArrow?: boolean;

  constructor(id: string) {
    super(id, COMPONENT_LINK);
  }

  setSourceNode(nodeId: string) {
    this.sourceNode = { nodeId };
  }

  setTargetNode(nodeId: string) {
    this.targetNode = { nodeId };
  }
}
