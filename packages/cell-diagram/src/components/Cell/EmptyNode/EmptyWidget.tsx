import { DiagramEngine, PortModelAlignment } from "@projectstorm/react-diagrams";
import { EmptyModel } from "./EmptyModel";
import { EmptyNode } from "./styles";
import { CellPortWidget } from "../CellPort/CellPortWidget";
import { CellPortModel } from "../CellPort/CellPortModel";
import { getNodePortId } from "../cell-util";
import { useDiagramContext } from "../../DiagramContext/DiagramContext";

interface EmptyWidgetProps {
    node: EmptyModel;
    engine: DiagramEngine;
}

export function EmptyWidget(props: EmptyWidgetProps) {
    const { node, engine } = props;
    const { previewMode } = useDiagramContext();

    return (
        <EmptyNode width={node.width} previewMode={previewMode}>
            <CellPortWidget port={node.getPort(getNodePortId(node.getID(), PortModelAlignment.TOP)) as CellPortModel} engine={engine} />
            <CellPortWidget port={node.getPort(getNodePortId(node.getID(), PortModelAlignment.BOTTOM)) as CellPortModel} engine={engine} />
            <CellPortWidget port={node.getPort(getNodePortId(node.getID(), PortModelAlignment.LEFT)) as CellPortModel} engine={engine} />
            <CellPortWidget port={node.getPort(getNodePortId(node.getID(), PortModelAlignment.RIGHT)) as CellPortModel} engine={engine} />
        </EmptyNode>
    );
}
