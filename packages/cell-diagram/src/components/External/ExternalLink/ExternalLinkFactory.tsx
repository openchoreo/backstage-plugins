import { DefaultLinkFactory } from '@projectstorm/react-diagrams';
import { ExternalLinkModel } from './ExternalLinkModel';
import { ExternalLinkWidget } from './ExternalLinkWidget';

export class ExternalLinkFactory extends DefaultLinkFactory {
    constructor() {
        super('externalLink');
    }

    generateModel(event: { initialConfig: any }): ExternalLinkModel {
        return new ExternalLinkModel(event.initialConfig.id);
    }

    generateReactWidget(props: { model: ExternalLinkModel }): JSX.Element {
        return <ExternalLinkWidget link={props.model} engine={this.engine} />;
    }
}
