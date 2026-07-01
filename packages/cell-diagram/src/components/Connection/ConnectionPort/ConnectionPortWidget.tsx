import { CSSProperties } from 'react';
import {
  DiagramEngine,
  PortModelAlignment,
  PortWidget,
} from '@projectstorm/react-diagrams';
import { ConnectionPortModel } from './ConnectionPortModel';
import { inclusionPortStyles, sidePortStyles } from './styles';

interface CustomPortProps {
  port: ConnectionPortModel;
  engine: DiagramEngine;
}

function getPortStyles(
  alignment: PortModelAlignment | undefined,
): CSSProperties {
  if (alignment === PortModelAlignment.LEFT) {
    return { left: 0, ...sidePortStyles };
  }
  if (alignment === PortModelAlignment.RIGHT) {
    return { right: 0, ...sidePortStyles };
  }
  if (alignment === PortModelAlignment.TOP) {
    return { top: 0, ...inclusionPortStyles };
  }
  return { bottom: 0, ...inclusionPortStyles };
}

export function ConnectionPortWidget(props: CustomPortProps) {
  const { port, engine } = props;
  const portStyles: CSSProperties = getPortStyles(port.getOptions().alignment);

  return <PortWidget engine={engine} port={port} style={portStyles} />;
}
