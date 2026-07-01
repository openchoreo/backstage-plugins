import { PortModelAlignment } from '@projectstorm/react-diagrams';
import { SharedNodeModel } from '../../SharedNode/SharedNode';
import { CellPortModel } from '../CellPort/CellPortModel';
import { getCellPortIdWithoutAlignment } from '../cell-util';
import { MAIN_CELL_DEFAULT_HEIGHT } from '../../../resources';
import { ConnectionModel } from '../../Connection/ConnectionNode/ConnectionModel';
import { Gateways } from '../../../types';

export enum CellBounds {
  NorthBound = 'nb',
  SouthBound = 'sb',
  EastBound = 'eb',
  WestBound = 'wb',
}

export class CellModel extends SharedNodeModel {
  width: number;
  gateways?: Gateways;
  readonly connectorNodes?: ConnectionModel[];
  readonly connectionNodes?: ConnectionModel[];

  constructor(
    cellName: string,
    width = MAIN_CELL_DEFAULT_HEIGHT,
    gateways?: Gateways,
    connectorNodes?: ConnectionModel[],
    connectionNodes?: ConnectionModel[],
  ) {
    super('cellNode', cellName);
    this.width = width;
    this.gateways = gateways;
    this.connectorNodes = connectorNodes;
    this.connectionNodes = connectionNodes;
    this.setLocked(true);

    // North bound ports - for public exposed APIs
    const northBoundPortName = getCellPortIdWithoutAlignment(
      cellName,
      CellBounds.NorthBound,
    );
    this.addPort(new CellPortModel(northBoundPortName, PortModelAlignment.TOP));
    this.addPort(
      new CellPortModel(northBoundPortName, PortModelAlignment.BOTTOM),
    );

    // West bound ports
    const westBoundPortName = getCellPortIdWithoutAlignment(
      cellName,
      CellBounds.WestBound,
    );
    this.addPort(new CellPortModel(westBoundPortName, PortModelAlignment.LEFT));
    this.addPort(
      new CellPortModel(westBoundPortName, PortModelAlignment.RIGHT),
    );

    // East bound ports - for other project connections
    if (this.connectionNodes) {
      this.connectionNodes.forEach((connectionNode: ConnectionModel) => {
        const portName = getCellPortIdWithoutAlignment(
          cellName,
          CellBounds.EastBound,
          connectionNode.connection.id,
        );
        this.addPort(new CellPortModel(portName, PortModelAlignment.LEFT));
        this.addPort(new CellPortModel(portName, PortModelAlignment.RIGHT));
      });
    }

    // South bound ports - for non platform connectors
    if (this.connectorNodes) {
      this.connectorNodes.forEach((connectorNode: ConnectionModel) => {
        const portName = getCellPortIdWithoutAlignment(
          cellName,
          CellBounds.SouthBound,
          connectorNode.connection.id,
        );
        this.addPort(new CellPortModel(portName, PortModelAlignment.TOP));
        this.addPort(new CellPortModel(portName, PortModelAlignment.BOTTOM));
      });
    }
  }

  setWidth(newWidth: number) {
    this.width = newWidth;
    this.updateDimensions({ width: newWidth, height: newWidth });
  }
}
