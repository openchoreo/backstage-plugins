import { DefaultLinkFactory } from '@projectstorm/react-diagrams';
import { ComponentLinkModel } from './ComponentLinkModel';
import { ComponentLinkWidget } from './ComponentLinkWidget';

export class ComponentLinkFactory extends DefaultLinkFactory {
  constructor() {
    super('componentLink');
  }

  generateModel(event: { initialConfig: any }): ComponentLinkModel {
    return new ComponentLinkModel(event.initialConfig.id);
  }

  generateReactWidget(props: { model: ComponentLinkModel }): JSX.Element {
    return <ComponentLinkWidget link={props.model} engine={this.engine} />;
  }
}
