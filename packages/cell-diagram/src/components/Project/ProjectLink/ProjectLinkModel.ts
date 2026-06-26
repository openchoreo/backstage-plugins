import { PROJECT_LINK } from "../../../resources";
import { SharedLinkModel } from "../../SharedLink/SharedLink";

interface LinkOrigins {
    nodeId: string;
}

export class ProjectLinkModel extends SharedLinkModel {
    sourceNode!: LinkOrigins;
    targetNode!: LinkOrigins;

    constructor(id: string) {
        super(id, PROJECT_LINK);
    }

    setSourceNode(nodeId: string) {
        this.sourceNode = { nodeId };
    }

    setTargetNode(nodeId: string) {
        this.targetNode = { nodeId };
    }
}
