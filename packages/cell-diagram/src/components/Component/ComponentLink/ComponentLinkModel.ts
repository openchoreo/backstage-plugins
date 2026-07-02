import { COMPONENT_LINK } from '../../../resources';
import { SharedLinkModel } from '../../SharedLink/SharedLink';

interface LinkOrigins {
  nodeId: string;
}

export class ComponentLinkModel extends SharedLinkModel {
  sourceNode!: LinkOrigins;
  targetNode!: LinkOrigins;

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
