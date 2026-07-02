import {
  DiagramEngine,
  PortModelAlignment,
  PortWidget,
} from '@projectstorm/react-diagrams';
import { ProjectPortModel } from './ProjectPortModel';
import {
  BottomPortNode,
  LeftPortNode,
  PortNode,
  RightPortNode,
  TopPortNode,
} from './styles';

interface CustomPortProps {
  port: ProjectPortModel;
  engine: DiagramEngine;
  isSelected: boolean;
}

export function ProjectPortWidget(props: CustomPortProps) {
  const { port, engine, isSelected } = props;

  let DynamicPotNode = PortNode;

  switch (port.getOptions().alignment) {
    case PortModelAlignment.LEFT:
      DynamicPotNode = LeftPortNode;
      break;
    case PortModelAlignment.RIGHT:
      DynamicPotNode = RightPortNode;
      break;
    case PortModelAlignment.TOP:
      DynamicPotNode = TopPortNode;
      break;
    case PortModelAlignment.BOTTOM:
      DynamicPotNode = BottomPortNode;
      break;
    default:
      break;
  }

  return (
    <DynamicPotNode isSelected={isSelected}>
      <PortWidget engine={engine} port={port} />
    </DynamicPotNode>
  );
}
