import { render } from "react-dom";
import { CellDiagram } from "./Diagram";
import { Project } from "./types";

export function renderDiagram(projectModel: string, target: HTMLDivElement) {
    const project: Project = JSON.parse(JSON.stringify(projectModel));
    render(<CellDiagram project={project} />, target);
}
