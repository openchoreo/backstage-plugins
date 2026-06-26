/*
 * Copyright (c) 2025, WSO2 LLC. (http://www.wso2.com) All Rights Reserved.
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { createContext, ReactNode, useContext } from "react";
import { DiagramLayer } from "../../types";
import { useActiveLayers } from "../../hooks/useActiveLayers";
import { MoreVertMenuItem, ObservationSummary } from "../../types";

interface IDiagramContext {
    selectedNodeId: string;
    focusedNodeId?: string;
    componentMenu?: MoreVertMenuItem[];
    zoomLevel: number;
    observationSummary?: ObservationSummary;
    modelVersion?: string;
    previewMode?: boolean;
    setSelectedNodeId: (id: string) => void;
    setFocusedNodeId?: (id: string) => void;
    onComponentDoubleClick?: (componentId: string) => void;
    diagramLayers: {
        activeLayers: DiagramLayer[];
        setLayer: (layer: DiagramLayer) => void;
        addLayer: (layer: DiagramLayer) => void;
        removeLayer: (layer: DiagramLayer) => void;
        hasLayer: (layer: DiagramLayer) => boolean;
    };
}
// Omitted states are handled by the Diagram context provider
type OmittedDiagramContext = Omit<IDiagramContext, "diagramLayers">;
interface DiagramContextProps extends OmittedDiagramContext {
    children: ReactNode;
    defaultDiagramLayer: DiagramLayer;
}

const defaultState: any = {};
export const DiagramContext = createContext<IDiagramContext>(defaultState);

export function CellDiagramContext(props: DiagramContextProps) {
    const {
        children,
        selectedNodeId,
        focusedNodeId,
        componentMenu,
        zoomLevel,
        observationSummary,
        defaultDiagramLayer,
        modelVersion,
        previewMode,
        setSelectedNodeId,
        setFocusedNodeId,
        onComponentDoubleClick,
    } = props;

    const { activeLayers, addLayer, removeLayer, setLayer, hasLayer } = useActiveLayers({ defaultDiagramLayer });

    const context: IDiagramContext = {
        selectedNodeId,
        focusedNodeId,
        componentMenu,
        zoomLevel,
        observationSummary,
        modelVersion,
        previewMode,
        setSelectedNodeId,
        setFocusedNodeId,
        onComponentDoubleClick,
        diagramLayers: {
            activeLayers,
            setLayer,
            addLayer,
            removeLayer,
            hasLayer,
        },
    };

    return <DiagramContext.Provider value={{ ...context }}>{children}</DiagramContext.Provider>;
}

export const useDiagramContext = () => useContext(DiagramContext);
