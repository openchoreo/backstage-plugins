import { DefaultLinkFactory } from '@projectstorm/react-diagrams';
import { CellLinkModel } from './CellLinkModel';
import { CellLinkWidget } from './CellLinkWidget';

export class CellLinkFactory extends DefaultLinkFactory {
    constructor() {
        super('cellLink');
    }

    generateModel(event: { initialConfig: any }): CellLinkModel {
        return new CellLinkModel(event.initialConfig.id);
    }

    generateReactWidget(props: { model: CellLinkModel }): JSX.Element {
        return <CellLinkWidget link={props.model} engine={this.engine} />;
    }
}
