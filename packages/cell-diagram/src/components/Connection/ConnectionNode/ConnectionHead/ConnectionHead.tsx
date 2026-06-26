import { useContext, useEffect, useRef, useState } from 'react';
import { DiagramEngine, PortModel } from '@projectstorm/react-diagrams';
import { ConnectionModel } from '../ConnectionModel';
import { ConnectionHead, IconWrapper } from '../styles';
import {
  ConnectionIcon,
  DatabaseIcon,
} from '../../../../resources/assets/icons';
import { ConnectionPortWidget } from '../../ConnectionPort/ConnectionPortWidget';
import { ConnectionPortModel } from '../../ConnectionPort/ConnectionPortModel';
import { ConnectionType } from '../../../../types';
import { DiagramContext } from '../../../DiagramContext/DiagramContext';
import {
  COMPONENT_LINE_MIN_WIDTH,
  COMPONENT_LINE_PREVIEW_WIDTH,
} from '../../../../resources';

interface ServiceHeadProps {
  engine: DiagramEngine;
  node: ConnectionModel;
  isSelected: boolean;
}

export function ConnectionHeadWidget(props: ServiceHeadProps) {
  const { engine, node, isSelected } = props;

  const { zoomLevel, previewMode } = useContext(DiagramContext);
  const headPorts = useRef<PortModel[]>([]);
  const [isHovered, setIsHovered] = useState<boolean>(false);

  useEffect(() => {
    headPorts.current.push(
      node.getPortFromID(`left-${node.getID()}`) as PortModel,
    );
    headPorts.current.push(
      node.getPortFromID(`right-${node.getID()}`) as PortModel,
    );
  }, [node]);

  const handleOnHover = (task: string) => {
    if (previewMode) {
      return;
    }
    setIsHovered(task === 'SELECT' ? true : false);
    node.handleHover(headPorts.current, task);
  };

  // get connection icon
  const getConnectionIcon = () => {
    switch (node.connection.type) {
      case ConnectionType.Datastore:
        return <DatabaseIcon />;
      default:
        return <ConnectionIcon />;
    }
  };

  return (
    <ConnectionHead
      isSelected={isSelected || isHovered}
      borderWidth={
        previewMode
          ? COMPONENT_LINE_PREVIEW_WIDTH
          : node.getDynamicLineWidth(zoomLevel, COMPONENT_LINE_MIN_WIDTH)
      }
      onMouseOver={() => handleOnHover('SELECT')}
      onMouseLeave={() => handleOnHover('UNSELECT')}
    >
      <IconWrapper previewMode={Boolean(previewMode)}>
        {getConnectionIcon()}
      </IconWrapper>
      <ConnectionPortWidget
        port={node.getPort(`top-${node.getID()}`) as ConnectionPortModel}
        engine={engine}
      />
      <ConnectionPortWidget
        port={node.getPort(`left-${node.getID()}`) as ConnectionPortModel}
        engine={engine}
      />
    </ConnectionHead>
  );
}
