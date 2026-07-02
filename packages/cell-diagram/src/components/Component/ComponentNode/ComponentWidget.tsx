import { MouseEvent, useContext, useEffect, useRef, useState } from 'react';
import {
  DiagramEngine,
  LinkModel,
  PortModel,
  PortModelAlignment,
} from '@projectstorm/react-diagrams';
import { ComponentModel } from './ComponentModel';
import { ComponentLinkModel } from '../ComponentLink/ComponentLinkModel';
import { ComponentHeadWidget } from './ComponentHead/ComponentHead';
import { ComponentName, ComponentNode, PortsContainer } from './styles';
import { DiagramContext } from '../../DiagramContext/DiagramContext';
import { ComponentPortWidget } from '../ComponentPort/ComponentPortWidget';
import Tooltip from '@mui/material/Tooltip';
import { ExternalConsumerLinkSelectEvent } from '../../../types';
import { CellBounds } from '../../Cell/CellNode/CellModel';
import { BaseEvent } from '@projectstorm/react-canvas-core';
import { ComponentPortModel } from '../ComponentPort/ComponentPortModel';

interface ComponentWidgetProps {
  node: ComponentModel;
  engine: DiagramEngine;
}

export function ComponentWidget(props: ComponentWidgetProps) {
  const { node, engine } = props;
  const {
    selectedNodeId,
    focusedNodeId,
    componentMenu,
    onComponentDoubleClick,
    previewMode,
  } = useContext(DiagramContext);
  const [selectedLink, setSelectedLink] = useState<
    ComponentLinkModel | undefined
  >(undefined);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const headPorts = useRef<PortModel[]>([]);

  const displayName: string = node.component.label || node.component.id;
  const isDisabled = Boolean(node.component.disabled?.status);

  useEffect(() => {
    if (previewMode) {
      return undefined;
    }
    const listener = node.registerListener({
      SELECT: (event: any) => {
        setSelectedLink(event.component as ComponentLinkModel);
      },
      UNSELECT: () => {
        setSelectedLink(undefined);
      },
    });
    headPorts.current.push(
      node.getPortFromID(`left-${node.getID()}`) as PortModel,
    );
    headPorts.current.push(
      node.getPortFromID(`right-${node.getID()}`) as PortModel,
    );
    headPorts.current.push(
      node.getPortFromID(`bottom-${node.getID()}`) as PortModel,
    );

    const handleExternalConsumerLink = (
      evt: ExternalConsumerLinkSelectEvent,
      action: 'SELECT' | 'UNSELECT',
    ) => {
      setIsHovered(action === 'SELECT');
      const portId = evt.cellBound === CellBounds.NorthBound ? 'top' : 'left';
      const alignment =
        evt.cellBound === CellBounds.NorthBound
          ? PortModelAlignment.TOP
          : PortModelAlignment.LEFT;
      const port = node.getPort(`${portId}-${node.getID()}`) as PortModel;
      const portLinks: Map<string, LinkModel> = new Map(
        Object.entries(port.links),
      );
      portLinks.forEach(link => {
        if (link.getTargetPort().getOptions().alignment === alignment) {
          link.fireEvent({}, action);
        }
      });
    };

    const externalConsumerListener = node.registerListener({
      EXTERNAL_CONSUMER_LINK_SELECT: (evt: BaseEvent) => {
        handleExternalConsumerLink(
          evt as ExternalConsumerLinkSelectEvent,
          'SELECT',
        );
      },
      EXTERNAL_CONSUMER_LINK_UNSELECT: (evt: BaseEvent) => {
        handleExternalConsumerLink(
          evt as ExternalConsumerLinkSelectEvent,
          'UNSELECT',
        );
      },
    });

    return () => {
      node.deregisterListener(listener);
      node.deregisterListener(externalConsumerListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node]);

  const handleOnHover = (task: string) => {
    setIsHovered(task === 'SELECT' ? true : false);
    node.handleHover(headPorts.current, task);
  };

  const handleOnWidgetDoubleClick = () => {
    if (onComponentDoubleClick) {
      onComponentDoubleClick(node.component.id);
    }
  };

  const handleMouseEnter = () => {
    if (previewMode) {
      return;
    }
    setIsHovered(true);
    handleOnHover('SELECT');
  };

  const handleMouseLeave = () => {
    if (previewMode) {
      return;
    }
    setIsHovered(false);
    handleOnHover('UNSELECT');
  };

  const handleOnContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <ComponentNode
      previewMode={Boolean(previewMode)}
      onMouseOver={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onDoubleClick={handleOnWidgetDoubleClick}
      onContextMenu={handleOnContextMenu}
    >
      <ComponentHeadWidget
        engine={engine}
        node={node}
        isSelected={
          node.getID() === selectedNodeId ||
          node.isNodeSelected(selectedLink as ComponentLinkModel, node.getID())
        }
        isFocused={node.getID() === focusedNodeId || isHovered}
        menuItems={componentMenu ?? []}
        onFocusOut={handleMouseLeave}
      />
      <Tooltip
        title={displayName}
        placement="bottom"
        enterNextDelay={500}
        arrow
      >
        {!previewMode ? (
          <ComponentName disabled={isDisabled}>{displayName}</ComponentName>
        ) : (
          <></>
        )}
      </Tooltip>
      <PortsContainer>
        <ComponentPortWidget
          port={node.getPort(`top-${node.getID()}`) as ComponentPortModel}
          engine={engine}
        />
        <ComponentPortWidget
          port={node.getPort(`bottom-${node.getID()}`) as ComponentPortModel}
          engine={engine}
        />
      </PortsContainer>
    </ComponentNode>
  );
}
