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

import { useState } from "react";
import { DiagramLayer } from "../types";

interface ActiveLayersHookProps {
    defaultDiagramLayer?: DiagramLayer;
}

export const useActiveLayers = (props: ActiveLayersHookProps) => {
    const [activeLayers, setActiveLayers] = useState<DiagramLayer[]>([props.defaultDiagramLayer as DiagramLayer]);

    const addLayer = (layer: DiagramLayer) => {
        if (!activeLayers.includes(layer)) {
            setActiveLayers((prev) => [...prev, layer]);
        }
    };

    const removeLayer = (layer: DiagramLayer) => {
        if (activeLayers.length > 1) {
            // Don't allow removing the last layer
            setActiveLayers(activeLayers.filter((l) => l !== layer));
        }
    };

    const setLayer = (layer: DiagramLayer) => {
        setActiveLayers([layer]);
    };

    const hasLayer = (layer: DiagramLayer) => {
        return activeLayers.includes(layer);
    };

    return { activeLayers, addLayer, removeLayer, setLayer, hasLayer };
};
