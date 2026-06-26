import { useContext, useEffect, useState } from "react";
import { DiagramEngine } from "@projectstorm/react-diagrams";
import { ConnectionModel } from "./ConnectionModel";
import { ConnectionHeadWidget } from "./ConnectionHead/ConnectionHead";
import { ConnectionName, ConnectionNode } from "./styles";
import { DiagramContext } from "../../DiagramContext/DiagramContext";
import { ComponentLinkModel } from "../../Component/ComponentLink/ComponentLinkModel";

interface ConnectionWidgetProps {
    node: ConnectionModel;
    engine: DiagramEngine;
}

export function ConnectionWidget(props: ConnectionWidgetProps) {
    const { node, engine } = props;
    const { selectedNodeId, focusedNodeId, previewMode } = useContext(DiagramContext);
    const [selectedLink, setSelectedLink] = useState<ComponentLinkModel | undefined>(undefined);
    const displayName = node.connection.label || node.connection.id;

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
        return () => {
            node.deregisterListener(listener);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [node]);

    return (
        <ConnectionNode
            previewMode={previewMode}
            isSelected={node.getID() === selectedNodeId || node.isNodeSelected(selectedLink as ComponentLinkModel, node.getID())}
            isFocused={node.getID() === focusedNodeId}
            orientation={node.orientation}
        >
            <ConnectionHeadWidget
                engine={engine}
                node={node}
                isSelected={node.getID() === selectedNodeId || node.isNodeSelected(selectedLink as ComponentLinkModel, node.getID())}
            />
            {!previewMode && <ConnectionName orientation={node.orientation}>{displayName}</ConnectionName>}
        </ConnectionNode>
    );
}
