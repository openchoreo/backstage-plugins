import { DefaultLinkFactory } from '@projectstorm/react-diagrams';
import { ProjectLinkModel } from './ProjectLinkModel';
import { ProjectLinkWidget } from './ProjectLinkWidget';
import { PROJECT_LINK } from '../../../resources';

export class ProjectLinkFactory extends DefaultLinkFactory {
    constructor() {
        super(PROJECT_LINK);
    }

    generateModel(event: { initialConfig: any }): ProjectLinkModel {
        return new ProjectLinkModel(event.initialConfig.id);
    }

    generateReactWidget(props: { model: ProjectLinkModel }): JSX.Element {
        return <ProjectLinkWidget link={props.model} engine={this.engine} />;
    }
}
