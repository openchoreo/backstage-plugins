import {} from 'react';
import { DiagramEngine } from '@projectstorm/react-diagrams';
import { ExternalModel } from './ExternalModel';
import { ExternalNode } from './styles';
import { CellPortWidget } from '../../Cell/CellPort/CellPortWidget';
import { CellPortModel } from '../../Cell/CellPort/CellPortModel';

interface ExternalWidgetProps {
  node: ExternalModel;
  engine: DiagramEngine;
}

export function ExternalWidget(props: ExternalWidgetProps) {
  const { node, engine } = props;
  return (
    <ExternalNode>
      <CellPortWidget
        port={node.getPort(`left-${node.getID()}`) as CellPortModel}
        engine={engine}
      />
      <CellPortWidget
        port={node.getPort(`right-${node.getID()}`) as CellPortModel}
        engine={engine}
      />
      <CellPortWidget
        port={node.getPort(`top-${node.getID()}`) as CellPortModel}
        engine={engine}
      />
      <CellPortWidget
        port={node.getPort(`bottom-${node.getID()}`) as CellPortModel}
        engine={engine}
      />
    </ExternalNode>
  );
}
