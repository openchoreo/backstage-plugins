import { PortModelAlignment } from "@projectstorm/react-diagrams";
import { SharedNodeModel } from "../../SharedNode/SharedNode";
import { ProjectPortModel } from "../ProjectPort/ProjectPortModel";
import { Project } from "../../../types";
import { PROJECT_NODE } from "../../../resources";
import { getProjectNameById } from "../../../utils";

export class ProjectModel extends SharedNodeModel {
    readonly project: Project;

    constructor(project: Project) {
        const name = getProjectNameById(project.id);
        super(PROJECT_NODE, name);
        this.project = project;
        // this.setLocked(true);

        this.addPort(new ProjectPortModel(name, PortModelAlignment.LEFT));
        this.addPort(new ProjectPortModel(name, PortModelAlignment.RIGHT));

        this.addPort(new ProjectPortModel(name, PortModelAlignment.TOP));
        this.addPort(new ProjectPortModel(name, PortModelAlignment.BOTTOM));
    }

    getPort(name: string): ProjectPortModel {
        return this.getPorts()[name] as ProjectPortModel;
    }
}
