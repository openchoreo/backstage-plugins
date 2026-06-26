import { AbstractReactFactory } from '@projectstorm/react-canvas-core';
import { DiagramEngine } from '@projectstorm/react-diagrams-core';
import { ProjectModel } from './ProjectModel';
import { ProjectWidget } from './ProjectWidget';
import { PROJECT_NODE } from '../../../resources';

export class ProjectFactory extends AbstractReactFactory<ProjectModel, DiagramEngine> {
    constructor() {
        super(PROJECT_NODE);
    }

    generateReactWidget(event: { model: ProjectModel }): JSX.Element {
        return <ProjectWidget engine={this.engine} node={event.model} />;
    }

    generateModel(event: { initialConfig: any }) {
        return new ProjectModel(event.initialConfig.component);
    }
}
