import { DiagramEngine, PortModel } from '@projectstorm/react-diagrams';
import { AbstractModelFactory } from '@projectstorm/react-canvas-core';
import { ProjectPortModel } from './ProjectPortModel';

export class ProjectPortFactory extends AbstractModelFactory<
  PortModel,
  DiagramEngine
> {
  constructor() {
    super('projectPort');
  }

  generateModel(event: { initialConfig: any }): ProjectPortModel {
    return new ProjectPortModel(
      event.initialConfig.id,
      event.initialConfig.portType,
    );
  }
}
